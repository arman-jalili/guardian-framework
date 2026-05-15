# Go Code Patterns

> **Purpose:** Reusable Go patterns for Guardian projects.
> **Generic:** Adapt for your framework (standard library, third-party).

---

## Error Handling

```go
// Custom error types
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error on field %s: %s", e.Field, e.Message)
}

type ConfigError struct {
    Reason string
}

func (e *ConfigError) Error() string {
    return fmt.Sprintf("config error: %s", e.Reason)
}

// Wrapped errors
func readFile(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("read file %s: %w", path, err)
    }
    return data, nil
}

// Error checking
func process(input string) error {
    result, err := parse(input)
    if err != nil {
        return fmt.Errorf("parse failed: %w", err)
    }
    return nil
}
```

---

## Tracing / Logging

```go
import (
    "log/slog"
    "context"
)

// Structured logging
var logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))

func processRequest(ctx context.Context, userID string, requestID string) {
    logger.InfoContext(ctx, "Processing request",
        slog.String("user_id", userID),
        slog.String("request_id", requestID),
    )

    result, err := doWork(ctx)
    if err != nil {
        logger.ErrorContext(ctx, "Request failed",
            slog.String("error", err.Error()),
        )
        return
    }

    logger.InfoContext(ctx, "Request complete",
        slog.Any("result", result),
    )
}

// Context-aware logging
func withContext(ctx context.Context) {
    // Add request ID to context
    ctx = context.WithValue(ctx, "request_id", "abc123")
    logger.InfoContext(ctx, "With context")
}
```

---

## Cancellation / Cleanup

```go
import (
    "context"
    "time"
)

// Context cancellation
func longRunningTask(ctx context.Context) error {
    for {
        // Check cancellation
        select {
        case <-ctx.Done():
            log.Println("Task cancelled, cleaning up")
            return ctx.Err()
        default:
            // Do work
            if err := doWork(); err != nil {
                return err
            }
        }

        // Sleep with cancellation awareness
        select {
        case <-time.After(1 * time.Second):
        case <-ctx.Done():
            return ctx.Err()
        }
    }
}

// Context with timeout
func fetchWithTimeout(url string) (*Response, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    return fetch(ctx, url)
}
```

---

## Atomic Writes

```go
import (
    "os"
    "path/filepath"
)

// Write-rename pattern
func atomicWrite(path string, content []byte) error {
    dir := filepath.Dir(path)
    tempPath := filepath.Join(dir, filepath.Base(path)+".tmp")

    // Write to temp file
    if err := os.WriteFile(tempPath, content, 0644); err != nil {
        return err
    }

    // Atomic rename
    if err := os.Rename(tempPath, path); err != nil {
        os.Remove(tempPath) // Cleanup on failure
        return err
    }

    return nil
}
```

---

## Concurrent Patterns

```go
import (
    "sync"
    "context"
)

// WaitGroup for parallel tasks
func parallelTasks() error {
    var wg sync.WaitGroup
    var err error
    var mu sync.Mutex

    for i := 0; i < 3; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            if e := task(id); e != nil {
                mu.Lock()
                if err == nil {
                    err = e
                }
                mu.Unlock()
            }
        }(i)
    }

    wg.Wait()
    return err
}

// Semaphore for concurrent limit
func concurrentLimit(tasks []Task, limit int) error {
    sem := make(chan struct{}, limit)
    var wg sync.WaitGroup

    for _, task := range tasks {
        wg.Add(1)
        go func(t Task) {
            defer wg.Done()
            sem <- struct{}{}        // Acquire
            defer func() { <-sem }() // Release

            return t.Execute()
        }(task)
    }

    wg.Wait()
    return nil
}

// Mutex for shared state
type Cache struct {
    mu   sync.RWMutex
    data map[string]string
}

func (c *Cache) Get(key string) (string, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    val, ok := c.data[key]
    return val, ok
}

func (c *Cache) Set(key, value string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = value
}
```

---

## Testing

```go
// Standard testing
func TestParse(t *testing.T) {
    result, err := parse("input")
    if err != nil {
        t.Fatalf("parse failed: %v", err)
    }
    if !result.OK {
        t.Errorf("expected OK, got false")
    }
}

// Table-driven tests
func TestValidation(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
    }{
        {"valid", "valid input", false},
        {"empty", "", true},
        {"invalid", "bad data", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := validate(tt.input)
            if tt.wantErr && err == nil {
                t.Errorf("expected error, got nil")
            }
            if !tt.wantErr && err != nil {
                t.Errorf("unexpected error: %v", err)
            }
        })
    }
}

// Mocking interfaces
type Fetcher interface {
    Fetch(url string) (*Response, error)
}

type MockFetcher struct {
    Response *Response
    Error    error
}

func (m *MockFetcher) Fetch(url string) (*Response, error) {
    return m.Response, m.Error
}

func TestWithMock(t *testing.T) {
    mock := &MockFetcher{Response: &Response{Data: "mock"}}
    result := useFetcher(mock)
    // ...
}
```

---

## Anti-Patterns (NEVER DO)

```go
// ❌ Ignoring errors
data, _ := os.ReadFile("file")  // BAD

// ✅ Always handle errors
data, err := os.ReadFile("file")
if err != nil {
    return fmt.Errorf("read file: %w", err)
}

// ❌ Panic for errors
func bad() {
    if err != nil {
        panic(err)  // BAD
    }
}

// ✅ Return errors
func good() error {
    if err != nil {
        return fmt.Errorf("operation failed: %w", err)
    }
    return nil
}

// ❌ Global mutable state
var config = map[string]string{}  // BAD

// ✅ Encapsulated state
type Config struct {
    data map[string]string
}

func NewConfig() *Config {
    return &Config{data: make(map[string]string)}
}

// ❌ Goroutine leaks
func bad() {
    go func() {
        for {
            doWork()  // BAD - never stops
        }
    }()
}

// ✅ Cancellable goroutine
func good(ctx context.Context) {
    go func() {
        for {
            select {
            case <-ctx.Done():
                return
            default:
                doWork()
            }
        }
    }()
}
```

---

## Build Commands

```bash
# Build
go build ./...

# Build binary
go build -o bin/app ./cmd/app

# Test
go test ./...

# Test with coverage
go test -cover ./...

# Test verbose
go test -v ./...

# Lint
golangci-lint run

# Format
go fmt ./...

# Vet
go vet ./...

# Security audit (gosec)
gosec ./...

# Mod tidy
go mod tidy
```

---

## Dependencies

```go
// go.mod
module github.com/your/project

go 1.21

require (
    // Standard patterns - no heavy dependencies
)
```