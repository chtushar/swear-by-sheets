package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Client represents the API client for communicating with the backend
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// ProcessResponse represents the response from the process endpoint
type ProcessResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	Transcript string `json:"transcript,omitempty"`
	Command    any    `json:"command,omitempty"`
	Result     any    `json:"result,omitempty"`
}

// NewClient creates a new API client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ProcessAudioFile sends an audio file to the backend for processing
func (c *Client) ProcessAudioFile(audioPath string, screenshotPath string) (*ProcessResponse, error) {
	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add audio file
	audioFile, err := os.Open(audioPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open audio file: %w", err)
	}
	defer audioFile.Close()

	audioWriter, err := writer.CreateFormFile("audio", filepath.Base(audioPath))
	if err != nil {
		return nil, fmt.Errorf("failed to create audio form field: %w", err)
	}

	if _, err := io.Copy(audioWriter, audioFile); err != nil {
		return nil, fmt.Errorf("failed to copy audio data: %w", err)
	}

	// Add screenshot if provided
	if screenshotPath != "" {
		screenshotFile, err := os.Open(screenshotPath)
		if err != nil {
			return nil, fmt.Errorf("failed to open screenshot file: %w", err)
		}
		defer screenshotFile.Close()

		screenshotWriter, err := writer.CreateFormFile("screenshot", filepath.Base(screenshotPath))
		if err != nil {
			return nil, fmt.Errorf("failed to create screenshot form field: %w", err)
		}

		if _, err := io.Copy(screenshotWriter, screenshotFile); err != nil {
			return nil, fmt.Errorf("failed to copy screenshot data: %w", err)
		}
	}

	// Close the writer to finalize the form
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	url := c.baseURL + "/agents/audio-transcription-agent/default"
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var processResp ProcessResponse
	if err := json.Unmarshal(respBody, &processResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &processResp, fmt.Errorf("server returned status %d: %s", resp.StatusCode, processResp.Error)
	}

	return &processResp, nil
}

// ProcessAudio sends audio data directly (as bytes) to the backend
func (c *Client) ProcessAudio(audioData []byte, screenshotData []byte) (*ProcessResponse, error) {
	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add audio data
	audioWriter, err := writer.CreateFormFile("audio", "recording.wav")
	if err != nil {
		return nil, fmt.Errorf("failed to create audio form field: %w", err)
	}

	if _, err := audioWriter.Write(audioData); err != nil {
		return nil, fmt.Errorf("failed to write audio data: %w", err)
	}

	// Add screenshot if provided
	if len(screenshotData) > 0 {
		screenshotWriter, err := writer.CreateFormFile("screenshot", "screenshot.png")
		if err != nil {
			return nil, fmt.Errorf("failed to create screenshot form field: %w", err)
		}

		if _, err := screenshotWriter.Write(screenshotData); err != nil {
			return nil, fmt.Errorf("failed to write screenshot data: %w", err)
		}
	}

	// Close the writer
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create and send request
	url := c.baseURL + "/agents/audio-transcription-agent/default"
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Read and parse response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var processResp ProcessResponse
	if err := json.Unmarshal(respBody, &processResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &processResp, fmt.Errorf("server returned status %d: %s", resp.StatusCode, processResp.Error)
	}

	return &processResp, nil
}

// HealthCheck performs a health check on the API
func (c *Client) HealthCheck() error {
	resp, err := c.httpClient.Get(c.baseURL + "/")
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned status %d", resp.StatusCode)
	}

	return nil
}
