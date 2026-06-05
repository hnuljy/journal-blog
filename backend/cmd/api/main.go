package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"
)

const (
	statusDraft     = "draft"
	statusPublished = "published"
)

type Config struct {
	AppEnv              string
	Port                string
	DatabaseURL         string
	JWTSecret           string
	AdminEmail          string
	AdminPassword       string
	AdminPasswordHash   string
	AllowedOrigins      []string
	AccessTokenTTL      time.Duration
	RefreshTokenTTL     time.Duration
	RefreshCookieName   string
	RefreshCookieSecure bool
}

type Post struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	Slug        string     `json:"slug" gorm:"size:180;uniqueIndex;not null"`
	Title       string     `json:"title" gorm:"size:180;not null"`
	Excerpt     string     `json:"excerpt" gorm:"size:300;not null"`
	Content     string     `json:"content" gorm:"type:text;not null"`
	CoverImage  string     `json:"coverImage" gorm:"size:500"`
	Status      string     `json:"status" gorm:"size:20;not null;default:draft"`
	PublishedAt *time.Time `json:"publishedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	Comments    []Comment  `json:"-" gorm:"constraint:OnDelete:CASCADE;"`
}

type Comment struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	PostID      uint      `json:"postId" gorm:"index;not null"`
	AuthorName  string    `json:"authorName" gorm:"size:120;not null"`
	AuthorEmail string    `json:"authorEmail" gorm:"size:180"`
	Content     string    `json:"content" gorm:"type:text;not null"`
	CreatedAt   time.Time `json:"createdAt"`
	Post        Post      `json:"post,omitempty"`
}

type RefreshToken struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Token     string    `json:"token" gorm:"size:128;uniqueIndex;not null"`
	UserEmail string    `json:"userEmail" gorm:"size:180;index;not null"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"index;not null"`
	CreatedAt time.Time `json:"createdAt"`
}

type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

type PostInput struct {
	Title      string `json:"title"`
	Slug       string `json:"slug"`
	Excerpt    string `json:"excerpt"`
	Content    string `json:"content"`
	CoverImage string `json:"coverImage"`
	Status     string `json:"status"`
}

type CommentInput struct {
	AuthorName  string `json:"authorName"`
	AuthorEmail string `json:"authorEmail"`
	Content     string `json:"content"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type DashboardStats struct {
	PostCount      int64 `json:"postCount"`
	PublishedCount int64 `json:"publishedCount"`
	CommentCount   int64 `json:"commentCount"`
}

type DashboardResponse struct {
	Stats    DashboardStats `json:"stats"`
	Posts    []PostSummary  `json:"posts"`
	Comments []Comment      `json:"comments"`
}

type PostSummary struct {
	ID           uint       `json:"id"`
	Slug         string     `json:"slug"`
	Title        string     `json:"title"`
	Excerpt      string     `json:"excerpt"`
	CoverImage   string     `json:"coverImage"`
	Status       string     `json:"status"`
	PublishedAt  *time.Time `json:"publishedAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
	CommentCount int64      `json:"commentCount"`
}

type PostDetailResponse struct {
	Post     Post      `json:"post"`
	Comments []Comment `json:"comments"`
}

type AuthResponse struct {
	AccessToken string         `json:"accessToken"`
	User        map[string]any `json:"user"`
}

func main() {
	cfg := loadConfig()

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: gormLogger.Default.LogMode(gormLogger.Warn),
	})
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}

	if err := db.AutoMigrate(&Post{}, &Comment{}, &RefreshToken{}); err != nil {
		log.Fatalf("database migration failed: %v", err)
	}

	if err := seedExampleContent(db); err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"service": "journal-blog-api",
			"status":  "ok",
			"time":    time.Now().UTC(),
		})
	})

	api := router.Group("/api/v1")
	{
		api.GET("/posts", func(ctx *gin.Context) {
			posts, err := listPublishedPostSummaries(db)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"posts": posts})
		})

		api.GET("/posts/:slug", func(ctx *gin.Context) {
			post, comments, err := getPublishedPostDetail(db, ctx.Param("slug"))
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					ctx.JSON(http.StatusNotFound, gin.H{"message": "Post not found."})
					return
				}

				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, PostDetailResponse{
				Post:     post,
				Comments: comments,
			})
		})

		api.POST("/posts/:slug/comments", func(ctx *gin.Context) {
			var input CommentInput
			if err := ctx.ShouldBindJSON(&input); err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body."})
				return
			}

			post, err := findPublishedPostBySlug(db, ctx.Param("slug"))
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					ctx.JSON(http.StatusNotFound, gin.H{"message": "Post not found."})
					return
				}

				abortServerError(ctx, err)
				return
			}

			comment := Comment{
				PostID:      post.ID,
				AuthorName:  strings.TrimSpace(input.AuthorName),
				AuthorEmail: strings.TrimSpace(strings.ToLower(input.AuthorEmail)),
				Content:     strings.TrimSpace(input.Content),
			}

			if comment.AuthorName == "" || comment.Content == "" {
				ctx.JSON(http.StatusBadRequest, gin.H{"message": "Name and comment are required."})
				return
			}

			if err := db.Create(&comment).Error; err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusCreated, gin.H{"comment": comment})
		})
	}

	auth := api.Group("/auth")
	{
		auth.POST("/login", func(ctx *gin.Context) {
			var input LoginInput
			if err := ctx.ShouldBindJSON(&input); err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body."})
				return
			}

			if !validAdminCredentials(cfg, strings.TrimSpace(strings.ToLower(input.Email)), input.Password) {
				ctx.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid email or password."})
				return
			}

			accessToken, err := signAccessToken(cfg, cfg.AdminEmail)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			refreshToken, refreshExpiry, err := issueRefreshToken(db, cfg)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			writeRefreshCookie(ctx, cfg, refreshToken, refreshExpiry)
			ctx.JSON(http.StatusOK, AuthResponse{
				AccessToken: accessToken,
				User: map[string]any{
					"email": cfg.AdminEmail,
					"role":  "admin",
				},
			})
		})

		auth.POST("/refresh", func(ctx *gin.Context) {
			tokenValue, err := ctx.Cookie(cfg.RefreshCookieName)
			if err != nil || strings.TrimSpace(tokenValue) == "" {
				ctx.JSON(http.StatusUnauthorized, gin.H{"message": "Refresh session not found."})
				return
			}

			record, err := findRefreshToken(db, tokenValue)
			if err != nil {
				ctx.JSON(http.StatusUnauthorized, gin.H{"message": "Refresh session is invalid."})
				return
			}

			if time.Now().After(record.ExpiresAt) {
				_ = revokeRefreshToken(db, tokenValue)
				clearRefreshCookie(ctx, cfg)
				ctx.JSON(http.StatusUnauthorized, gin.H{"message": "Refresh session expired."})
				return
			}

			accessToken, err := signAccessToken(cfg, record.UserEmail)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, AuthResponse{
				AccessToken: accessToken,
				User: map[string]any{
					"email": record.UserEmail,
					"role":  "admin",
				},
			})
		})

		auth.POST("/logout", func(ctx *gin.Context) {
			tokenValue, err := ctx.Cookie(cfg.RefreshCookieName)
			if err == nil && tokenValue != "" {
				_ = revokeRefreshToken(db, tokenValue)
			}

			clearRefreshCookie(ctx, cfg)
			ctx.JSON(http.StatusOK, gin.H{"message": "Signed out successfully."})
		})
	}

	admin := api.Group("/admin")
	admin.Use(authMiddleware(cfg))
	{
		admin.GET("/me", func(ctx *gin.Context) {
			ctx.JSON(http.StatusOK, gin.H{
				"user": gin.H{
					"email": ctx.GetString("userEmail"),
					"role":  "admin",
				},
			})
		})

		admin.GET("/dashboard", func(ctx *gin.Context) {
			stats, err := getDashboardStats(db)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			posts, err := listAllPostSummaries(db)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			comments, err := listAdminComments(db)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, DashboardResponse{
				Stats:    stats,
				Posts:    posts,
				Comments: comments,
			})
		})

		admin.GET("/posts", func(ctx *gin.Context) {
			posts, err := listAllPostSummaries(db)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"posts": posts})
		})

		admin.GET("/posts/:id", func(ctx *gin.Context) {
			post, err := findPostByID(db, ctx.Param("id"))
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					ctx.JSON(http.StatusNotFound, gin.H{"message": "Post not found."})
					return
				}

				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"post": post})
		})

		admin.POST("/posts", func(ctx *gin.Context) {
			var input PostInput
			if err := ctx.ShouldBindJSON(&input); err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body."})
				return
			}

			post, err := createPost(db, input)
			if err != nil {
				handlePostError(ctx, err)
				return
			}

			ctx.JSON(http.StatusCreated, gin.H{"post": post})
		})

		admin.PUT("/posts/:id", func(ctx *gin.Context) {
			var input PostInput
			if err := ctx.ShouldBindJSON(&input); err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body."})
				return
			}

			post, err := updatePost(db, ctx.Param("id"), input)
			if err != nil {
				handlePostError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"post": post})
		})

		admin.DELETE("/posts/:id", func(ctx *gin.Context) {
			post, err := findPostByID(db, ctx.Param("id"))
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					ctx.JSON(http.StatusNotFound, gin.H{"message": "Post not found."})
					return
				}

				abortServerError(ctx, err)
				return
			}

			if err := db.Delete(&post).Error; err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"message": "Post deleted successfully."})
		})

		admin.GET("/comments", func(ctx *gin.Context) {
			comments, err := listAdminComments(db)
			if err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"comments": comments})
		})

		admin.DELETE("/comments/:id", func(ctx *gin.Context) {
			commentID, err := strconv.Atoi(ctx.Param("id"))
			if err != nil {
				ctx.JSON(http.StatusBadRequest, gin.H{"message": "Comment id is invalid."})
				return
			}

			if err := db.Delete(&Comment{}, commentID).Error; err != nil {
				abortServerError(ctx, err)
				return
			}

			ctx.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully."})
		})
	}

	log.Printf("journal-blog api listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

func loadConfig() Config {
	appEnv := readEnv("APP_ENV", "development")
	port := readEnv("PORT", "8080")
	databaseURL := readEnv("DATABASE_URL", "postgresql://journal_blog:journal_blog_password@localhost:5432/journal_blog")
	jwtSecret := readEnv("JWT_SECRET", "replace-with-a-long-random-secret")
	adminEmail := strings.ToLower(readEnv("ADMIN_EMAIL", "admin@example.com"))
	adminPassword := readEnv("ADMIN_PASSWORD", "change-me-now")
	adminPasswordHash := readEnv("ADMIN_PASSWORD_HASH", "")
	allowedOrigins := splitCSV(readEnv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))

	return Config{
		AppEnv:              appEnv,
		Port:                port,
		DatabaseURL:         databaseURL,
		JWTSecret:           jwtSecret,
		AdminEmail:          adminEmail,
		AdminPassword:       adminPassword,
		AdminPasswordHash:   adminPasswordHash,
		AllowedOrigins:      allowedOrigins,
		AccessTokenTTL:      2 * time.Hour,
		RefreshTokenTTL:     7 * 24 * time.Hour,
		RefreshCookieName:   "journal_blog_refresh",
		RefreshCookieSecure: appEnv == "production",
	}
}

func readEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))

	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}

func validAdminCredentials(cfg Config, email, password string) bool {
	if email != cfg.AdminEmail {
		return false
	}

	if cfg.AdminPasswordHash != "" {
		return bcrypt.CompareHashAndPassword([]byte(cfg.AdminPasswordHash), []byte(password)) == nil
	}

	return password == cfg.AdminPassword
}

func signAccessToken(cfg Config, email string) (string, error) {
	now := time.Now()
	claims := Claims{
		Email: email,
		Role:  "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.AccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   email,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

func issueRefreshToken(db *gorm.DB, cfg Config) (string, time.Time, error) {
	tokenValue, err := randomToken(48)
	if err != nil {
		return "", time.Time{}, err
	}

	expiresAt := time.Now().Add(cfg.RefreshTokenTTL)
	record := RefreshToken{
		Token:     tokenValue,
		UserEmail: cfg.AdminEmail,
		ExpiresAt: expiresAt,
	}

	if err := db.Create(&record).Error; err != nil {
		return "", time.Time{}, err
	}

	return tokenValue, expiresAt, nil
}

func findRefreshToken(db *gorm.DB, tokenValue string) (RefreshToken, error) {
	var record RefreshToken
	err := db.Where("token = ?", tokenValue).First(&record).Error
	return record, err
}

func revokeRefreshToken(db *gorm.DB, tokenValue string) error {
	return db.Where("token = ?", tokenValue).Delete(&RefreshToken{}).Error
}

func writeRefreshCookie(ctx *gin.Context, cfg Config, tokenValue string, expiresAt time.Time) {
	ctx.SetSameSite(http.SameSiteLaxMode)
	ctx.SetCookie(
		cfg.RefreshCookieName,
		tokenValue,
		int(time.Until(expiresAt).Seconds()),
		"/",
		"",
		cfg.RefreshCookieSecure,
		true,
	)
}

func clearRefreshCookie(ctx *gin.Context, cfg Config) {
	ctx.SetSameSite(http.SameSiteLaxMode)
	ctx.SetCookie(cfg.RefreshCookieName, "", -1, "/", "", cfg.RefreshCookieSecure, true)
}

func authMiddleware(cfg Config) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		header := strings.TrimSpace(ctx.GetHeader("Authorization"))
		if !strings.HasPrefix(header, "Bearer ") {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Authorization header is required."})
			return
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Access token is invalid."})
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid || claims.Role != "admin" {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": "Access token is invalid."})
			return
		}

		ctx.Set("userEmail", claims.Email)
		ctx.Next()
	}
}

func getPublishedPostDetail(db *gorm.DB, slug string) (Post, []Comment, error) {
	post, err := findPublishedPostBySlug(db, slug)
	if err != nil {
		return Post{}, nil, err
	}

	var comments []Comment
	if err := db.Where("post_id = ?", post.ID).Order("created_at DESC").Find(&comments).Error; err != nil {
		return Post{}, nil, err
	}

	return post, comments, nil
}

func findPublishedPostBySlug(db *gorm.DB, slug string) (Post, error) {
	var post Post
	err := db.Where("slug = ? AND status = ?", slug, statusPublished).First(&post).Error
	return post, err
}

func findPostByID(db *gorm.DB, idValue string) (Post, error) {
	id, err := strconv.Atoi(idValue)
	if err != nil {
		return Post{}, fmt.Errorf("invalid id")
	}

	var post Post
	err = db.First(&post, id).Error
	return post, err
}

func createPost(db *gorm.DB, input PostInput) (Post, error) {
	normalized, err := normalizePostInput(db, input, nil)
	if err != nil {
		return Post{}, err
	}

	if err := db.Create(&normalized).Error; err != nil {
		return Post{}, err
	}

	return normalized, nil
}

func updatePost(db *gorm.DB, idValue string, input PostInput) (Post, error) {
	post, err := findPostByID(db, idValue)
	if err != nil {
		return Post{}, err
	}

	normalized, err := normalizePostInput(db, input, &post)
	if err != nil {
		return Post{}, err
	}

	post.Title = normalized.Title
	post.Slug = normalized.Slug
	post.Excerpt = normalized.Excerpt
	post.Content = normalized.Content
	post.CoverImage = normalized.CoverImage
	post.Status = normalized.Status
	post.PublishedAt = normalized.PublishedAt

	if err := db.Save(&post).Error; err != nil {
		return Post{}, err
	}

	return post, nil
}

func normalizePostInput(db *gorm.DB, input PostInput, existing *Post) (Post, error) {
	title := strings.TrimSpace(input.Title)
	content := strings.TrimSpace(input.Content)
	if title == "" || content == "" {
		return Post{}, fmt.Errorf("title and content are required")
	}

	status := statusDraft
	if strings.TrimSpace(input.Status) == statusPublished {
		status = statusPublished
	}

	baseSlug := slugify(input.Slug)
	if baseSlug == "" {
		baseSlug = slugify(title)
	}
	if baseSlug == "" {
		baseSlug = "post"
	}

	nextSlug, err := uniqueSlug(db, baseSlug, existing)
	if err != nil {
		return Post{}, err
	}

	excerpt := strings.TrimSpace(input.Excerpt)
	if excerpt == "" {
		excerpt = excerptFromContent(content, 160)
	}

	coverImage := strings.TrimSpace(input.CoverImage)
	var publishedAt *time.Time
	if status == statusPublished {
		now := time.Now().UTC()
		if existing != nil && existing.PublishedAt != nil {
			publishedAt = existing.PublishedAt
		} else {
			publishedAt = &now
		}
	}

	return Post{
		Slug:        nextSlug,
		Title:       title,
		Excerpt:     excerpt,
		Content:     content,
		CoverImage:  coverImage,
		Status:      status,
		PublishedAt: publishedAt,
	}, nil
}

func uniqueSlug(db *gorm.DB, base string, existing *Post) (string, error) {
	slug := base
	counter := 1

	for {
		var post Post
		err := db.Where("slug = ?", slug).First(&post).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return slug, nil
		}
		if err != nil {
			return "", err
		}

		if existing != nil && post.ID == existing.ID {
			return slug, nil
		}

		counter++
		slug = fmt.Sprintf("%s-%d", base, counter)
	}
}

func listPublishedPostSummaries(db *gorm.DB) ([]PostSummary, error) {
	var posts []Post
	if err := db.Where("status = ?", statusPublished).
		Order("COALESCE(published_at, created_at) DESC").
		Find(&posts).Error; err != nil {
		return nil, err
	}

	return mapPostSummaries(db, posts)
}

func listAllPostSummaries(db *gorm.DB) ([]PostSummary, error) {
	var posts []Post
	if err := db.Order("updated_at DESC").Find(&posts).Error; err != nil {
		return nil, err
	}

	return mapPostSummaries(db, posts)
}

func mapPostSummaries(db *gorm.DB, posts []Post) ([]PostSummary, error) {
	summaries := make([]PostSummary, 0, len(posts))

	for _, post := range posts {
		var commentCount int64
		if err := db.Model(&Comment{}).Where("post_id = ?", post.ID).Count(&commentCount).Error; err != nil {
			return nil, err
		}

		summaries = append(summaries, PostSummary{
			ID:           post.ID,
			Slug:         post.Slug,
			Title:        post.Title,
			Excerpt:      post.Excerpt,
			CoverImage:   post.CoverImage,
			Status:       post.Status,
			PublishedAt:  post.PublishedAt,
			CreatedAt:    post.CreatedAt,
			UpdatedAt:    post.UpdatedAt,
			CommentCount: commentCount,
		})
	}

	return summaries, nil
}

func listAdminComments(db *gorm.DB) ([]Comment, error) {
	var comments []Comment
	if err := db.Preload("Post").Order("created_at DESC").Find(&comments).Error; err != nil {
		return nil, err
	}

	return comments, nil
}

func getDashboardStats(db *gorm.DB) (DashboardStats, error) {
	var postCount int64
	var publishedCount int64
	var commentCount int64

	if err := db.Model(&Post{}).Count(&postCount).Error; err != nil {
		return DashboardStats{}, err
	}
	if err := db.Model(&Post{}).Where("status = ?", statusPublished).Count(&publishedCount).Error; err != nil {
		return DashboardStats{}, err
	}
	if err := db.Model(&Comment{}).Count(&commentCount).Error; err != nil {
		return DashboardStats{}, err
	}

	return DashboardStats{
		PostCount:      postCount,
		PublishedCount: publishedCount,
		CommentCount:   commentCount,
	}, nil
}

func handlePostError(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"message": "Post not found."})
	case strings.Contains(err.Error(), "title and content are required"):
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Title and content are required."})
	case strings.Contains(err.Error(), "invalid id"):
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "Post id is invalid."})
	default:
		abortServerError(ctx, err)
	}
}

func abortServerError(ctx *gin.Context, err error) {
	log.Printf("request failed: %v", err)
	ctx.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error."})
}

func slugify(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}

	replacer := regexp.MustCompile(`[^a-z0-9]+`)
	slug := replacer.ReplaceAllString(trimmed, "-")
	return strings.Trim(slug, "-")
}

func excerptFromContent(value string, max int) string {
	normalized := strings.Join(strings.Fields(value), " ")
	if len(normalized) <= max {
		return normalized
	}

	return normalized[:max] + "..."
}

func randomToken(bytesLength int) (string, error) {
	buf := make([]byte, bytesLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	return hex.EncodeToString(buf), nil
}

func seedExampleContent(db *gorm.DB) error {
	var count int64
	if err := db.Model(&Post{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	now := time.Now().UTC()
	post := Post{
		Slug:        "welcome-to-journal-blog",
		Title:       "Welcome to Journal Blog",
		Excerpt:     "This is the first published post generated by the Go API seed routine.",
		Content:     "This starter project includes a Vue frontend, a Go API, admin login, post management, and comments. Replace this text with your first real article.",
		Status:      statusPublished,
		PublishedAt: &now,
	}

	return db.Create(&post).Error
}
