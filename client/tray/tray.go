package tray

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chtushar/swear-by-sheets/client/api"
	"github.com/chtushar/swear-by-sheets/client/audio"
	"github.com/chtushar/swear-by-sheets/client/screen"
	"github.com/getlantern/systray"
	"github.com/getlantern/systray/example/icon"
)

// Tray struct
type Tray struct {
	ctx            context.Context
	isRecording    bool
	toggleMenuItem *systray.MenuItem
	quitMenuItem   *systray.MenuItem
	audioRecorder  *audio.Recorder
	screenRecorder *screen.Recorder
	apiClient      *api.Client
	recordingsDir  string
}

// New creates a new Tray application struct
func New() *Tray {
	return &Tray{
		isRecording: false,
	}
}

func (t *Tray) Startup(ctx context.Context) error {
	t.ctx = ctx

	// Initialize audio recorder
	t.audioRecorder = audio.NewRecorder()
	// Initialize screen recorder
	t.screenRecorder = screen.NewRecorder()
	apiURL := "http://localhost:8787"
	if envURL := os.Getenv("SWEAR_BY_SHEETS_API_URL"); envURL != "" {
		apiURL = envURL
	}
	t.apiClient = api.NewClient(apiURL)

	// Create recordings directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %v", err)
	}
	t.recordingsDir = filepath.Join(homeDir, "SwearBySheets", "recordings")
	if err := os.MkdirAll(t.recordingsDir, 0755); err != nil {
		return fmt.Errorf("failed to create recordings directory: %v", err)
	}

	// TODO: Initialize other dependencies
	// - HTTP client

	systray.Run(t.onReady, t.onExit)
	return nil
}

func (t *Tray) onReady() {
	systray.SetIcon(icon.Data)
	systray.SetTooltip("Voice + Screen control for Google Sheets")

	t.setupToggleRecording()
	systray.AddSeparator()
	t.setupQuit()
}

func (t *Tray) setupQuit() {
	t.quitMenuItem = systray.AddMenuItem("Quit", "Quit the application")
	go func() {
		for {
			select {
			case <-t.quitMenuItem.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func (t *Tray) setupToggleRecording() {
	t.toggleMenuItem = systray.AddMenuItem("Start Recording", "Toggle voice and screen recording")
	go func() {
		for {
			select {
			case <-t.toggleMenuItem.ClickedCh:
				if t.isRecording {
					t.stopRecording()
				} else {
					t.startRecording()
				}
			}
		}
	}()
}

func (t *Tray) onExit() {
	// Cleanup resources here
	if t.isRecording {
		t.stopRecording()
	}
	log.Println("Application exiting...")
}

func (t *Tray) startRecording() {
	// Start audio recording
	if err := t.audioRecorder.StartRecording(); err != nil {
		log.Printf("Failed to start audio recording: %v", err)
		systray.SetTooltip(fmt.Sprintf("Failed to start recording: %v", err))
		return
	}

	// Start screen recording
	if err := t.screenRecorder.StartRecording(); err != nil {
		log.Printf("Failed to start screen recording: %v", err)
		// Continue with audio only if screen fails
	}

	t.isRecording = true
	t.toggleMenuItem.SetTitle("Stop Recording")
	systray.SetTooltip("Recording in progress...")

	log.Println("Recording started")
}

func (t *Tray) stopRecording() {
	// Stop audio recording
	if err := t.audioRecorder.StopRecording(); err != nil {
		log.Printf("Failed to stop audio recording: %v", err)
	}

	// Stop screen recording
	if err := t.screenRecorder.StopRecording(); err != nil {
		log.Printf("Failed to stop screen recording: %v", err)
	}

	// Save audio file
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	audioFile := filepath.Join(t.recordingsDir, fmt.Sprintf("audio_%s.wav", timestamp))
	if err := t.audioRecorder.SaveToFile(audioFile); err != nil {
		log.Printf("Failed to save audio file: %v", err)
		systray.SetTooltip(fmt.Sprintf("Failed to save recording: %v", err))
	} else {
		log.Printf("Audio saved to: %s", audioFile)
	}

	// Save screenshot file
	var screenshotFile string
	if t.screenRecorder.HasScreenshot() {
		screenshotFile = filepath.Join(t.recordingsDir, fmt.Sprintf("screenshot_%s.png", timestamp))
		if err := t.screenRecorder.SaveToFile(screenshotFile); err != nil {
			log.Printf("Failed to save screenshot: %v", err)
		} else {
			log.Printf("Screenshot saved to: %s", screenshotFile)
		}
	}

	systray.SetTooltip("Processing audio and screenshot...")

	// Send audio and screenshot to backend for processing
	go func() {
		log.Println("Sending audio and screenshot to backend...")
		resp, err := t.apiClient.ProcessAudioFile(audioFile, screenshotFile)
		if err != nil {
			log.Printf("Failed to process audio: %v", err)
			systray.SetTooltip(fmt.Sprintf("Failed to process: %v", err))
			return
		}

		if resp.Success {
			log.Printf("Audio processed successfully")
			systray.SetTooltip("Command executed successfully!")

			// Log the response details if available
			if resp.Transcript != "" {
				log.Printf("Transcript: %s", resp.Transcript)
			}
			if resp.Command != nil {
				log.Printf("Command: %v", resp.Command)
			}
			if resp.Result != nil {
				log.Printf("Result: %v", resp.Result)
			}
		} else {
			log.Printf("Processing failed: %s", resp.Error)
			systray.SetTooltip(fmt.Sprintf("Processing failed: %s", resp.Error))
		}
	}()

	t.isRecording = false
	t.toggleMenuItem.SetTitle("Start Recording")

	log.Println("Recording stopped")
}
