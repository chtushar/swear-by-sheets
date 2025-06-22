package screen

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"sync"
	"time"

	"github.com/kbinani/screenshot"
)

// Recorder handles screen capture
type Recorder struct {
	latestImage *image.RGBA
	recording   bool
	mu          sync.Mutex
	stopChan    chan bool
	wg          sync.WaitGroup
}

// NewRecorder creates a new screen recorder
func NewRecorder() *Recorder {
	return &Recorder{
		stopChan: make(chan bool),
	}
}

// StartRecording begins screen capture
func (r *Recorder) StartRecording() error {
	r.mu.Lock()
	if r.recording {
		r.mu.Unlock()
		return fmt.Errorf("already recording")
	}
	r.recording = true
	r.latestImage = nil // Clear previous screenshot
	r.mu.Unlock()

	// Check if we can capture screen
	n := screenshot.NumActiveDisplays()
	if n <= 0 {
		r.mu.Lock()
		r.recording = false
		r.mu.Unlock()
		return fmt.Errorf("no active displays found")
	}

	r.wg.Add(1)
	go r.captureLoop()

	return nil
}

// StopRecording stops screen capture
func (r *Recorder) StopRecording() error {
	r.mu.Lock()
	if !r.recording {
		r.mu.Unlock()
		return fmt.Errorf("not recording")
	}
	r.recording = false
	r.mu.Unlock()

	// Signal stop
	close(r.stopChan)
	r.wg.Wait()

	// Reset for next recording
	r.stopChan = make(chan bool)

	return nil
}

// SaveToFile saves the latest screenshot as a PNG file
func (r *Recorder) SaveToFile(filename string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.latestImage == nil {
		return fmt.Errorf("no screenshot to save")
	}

	file, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create file: %v", err)
	}
	defer file.Close()

	if err := png.Encode(file, r.latestImage); err != nil {
		return fmt.Errorf("failed to encode image: %v", err)
	}

	return nil
}

// captureLoop captures screenshots every second
func (r *Recorder) captureLoop() {
	defer r.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// Capture initial screenshot immediately
	r.captureScreen()

	for {
		select {
		case <-r.stopChan:
			return
		case <-ticker.C:
			r.captureScreen()
		}
	}
}

// captureScreen captures a single screenshot
func (r *Recorder) captureScreen() {
	// Get the bounds of the primary display
	bounds := screenshot.GetDisplayBounds(0)

	// Capture the screen
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		// Log error but continue recording
		fmt.Printf("Failed to capture screen: %v\n", err)
		return
	}

	// Convert to RGBA if needed
	rgba := image.NewRGBA(img.Bounds())
	for y := img.Bounds().Min.Y; y < img.Bounds().Max.Y; y++ {
		for x := img.Bounds().Min.X; x < img.Bounds().Max.X; x++ {
			rgba.Set(x, y, img.At(x, y))
		}
	}

	// Update latest screenshot
	r.mu.Lock()
	r.latestImage = rgba
	r.mu.Unlock()
}

// IsRecording returns whether the recorder is currently recording
func (r *Recorder) IsRecording() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.recording
}

// HasScreenshot returns whether a screenshot is available
func (r *Recorder) HasScreenshot() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.latestImage != nil
}

// GetScreenshotBounds returns the bounds of the latest screenshot
func (r *Recorder) GetScreenshotBounds() (image.Rectangle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.latestImage == nil {
		return image.Rectangle{}, fmt.Errorf("no screenshot available")
	}

	return r.latestImage.Bounds(), nil
}
