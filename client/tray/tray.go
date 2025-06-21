package tray

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/chtushar/swear-by-sheets/client/audio"
	"github.com/getlantern/systray"
)

// Tray struct
type Tray struct {
	ctx            context.Context
	isRecording    bool
	toggleMenuItem *systray.MenuItem
	quitMenuItem   *systray.MenuItem
	audioRecorder  *audio.Recorder
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
	// - Screen capture
	// - HTTP client

	systray.Run(t.onReady, t.onExit)
	return nil
}

func (t *Tray) onReady() {
	// TODO: Set custom icon
	systray.SetTitle("Swear by Sheets")
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

	t.isRecording = true
	t.toggleMenuItem.SetTitle("Stop Recording")
	systray.SetTooltip("Recording in progress...")

	// TODO: Start screen capture

	log.Println("Recording started")
}

func (t *Tray) stopRecording() {
	// Stop audio recording
	if err := t.audioRecorder.StopRecording(); err != nil {
		log.Printf("Failed to stop audio recording: %v", err)
	}

	// Save audio file
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	audioFile := filepath.Join(t.recordingsDir, fmt.Sprintf("audio_%s.wav", timestamp))
	if err := t.audioRecorder.SaveToFile(audioFile); err != nil {
		log.Printf("Failed to save audio file: %v", err)
		systray.SetTooltip(fmt.Sprintf("Failed to save recording: %v", err))
	} else {
		log.Printf("Audio saved to: %s", audioFile)
		systray.SetTooltip(fmt.Sprintf("Recording saved to %s", audioFile))
	}

	t.isRecording = false
	t.toggleMenuItem.SetTitle("Start Recording")

	// TODO: Stop screen capture and send to API

	log.Println("Recording stopped")
}
