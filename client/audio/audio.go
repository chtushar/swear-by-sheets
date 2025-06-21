package audio

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	"github.com/gordonklaus/portaudio"
)

const (
	sampleRate      = 44100
	channels        = 1
	framesPerBuffer = 1024
)

// Recorder handles audio recording
type Recorder struct {
	stream    *portaudio.Stream
	buffer    []int16
	recording bool
	mu        sync.Mutex
	stopChan  chan bool
	wg        sync.WaitGroup
}

// NewRecorder creates a new audio recorder
func NewRecorder() *Recorder {
	return &Recorder{
		buffer:   make([]int16, 0),
		stopChan: make(chan bool),
	}
}

// StartRecording begins audio capture
func (r *Recorder) StartRecording() error {
	r.mu.Lock()
	if r.recording {
		r.mu.Unlock()
		return fmt.Errorf("already recording")
	}
	r.recording = true
	r.buffer = make([]int16, 0) // Clear buffer
	r.mu.Unlock()

	// Initialize PortAudio
	if err := portaudio.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize portaudio: %v", err)
	}

	// Create input stream
	stream, err := portaudio.OpenDefaultStream(
		channels,        // input channels
		0,               // output channels
		sampleRate,      // sample rate
		framesPerBuffer, // frames per buffer
		r.processAudio,
	)
	if err != nil {
		portaudio.Terminate()
		return fmt.Errorf("failed to open stream: %v", err)
	}

	r.stream = stream

	// Start the stream
	if err := r.stream.Start(); err != nil {
		r.stream.Close()
		portaudio.Terminate()
		return fmt.Errorf("failed to start stream: %v", err)
	}

	r.wg.Add(1)
	go r.recordingLoop()

	return nil
}

// StopRecording stops audio capture
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

	// Stop and close stream
	if r.stream != nil {
		if err := r.stream.Stop(); err != nil {
			return fmt.Errorf("failed to stop stream: %v", err)
		}
		if err := r.stream.Close(); err != nil {
			return fmt.Errorf("failed to close stream: %v", err)
		}
	}

	// Terminate PortAudio
	if err := portaudio.Terminate(); err != nil {
		return fmt.Errorf("failed to terminate portaudio: %v", err)
	}

	// Reset for next recording
	r.stopChan = make(chan bool)

	return nil
}

// SaveToFile saves the recorded audio as a WAV file
func (r *Recorder) SaveToFile(filename string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.buffer) == 0 {
		return fmt.Errorf("no audio data to save")
	}

	file, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create file: %v", err)
	}
	defer file.Close()

	// Write WAV header
	if err := r.writeWAVHeader(file, len(r.buffer)*2); err != nil {
		return fmt.Errorf("failed to write WAV header: %v", err)
	}

	// Write audio data
	buf := new(bytes.Buffer)
	for _, sample := range r.buffer {
		if err := binary.Write(buf, binary.LittleEndian, sample); err != nil {
			return fmt.Errorf("failed to write audio data: %v", err)
		}
	}

	if _, err := file.Write(buf.Bytes()); err != nil {
		return fmt.Errorf("failed to write to file: %v", err)
	}

	return nil
}

// processAudio is the callback for audio processing
func (r *Recorder) processAudio(in []int16) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.recording {
		r.buffer = append(r.buffer, in...)
	}
}

// recordingLoop handles the recording lifecycle
func (r *Recorder) recordingLoop() {
	defer r.wg.Done()
	<-r.stopChan
}

// writeWAVHeader writes a WAV file header
func (r *Recorder) writeWAVHeader(w io.Writer, dataSize int) error {
	// RIFF header
	if _, err := w.Write([]byte("RIFF")); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(dataSize+36)); err != nil {
		return err
	}
	if _, err := w.Write([]byte("WAVE")); err != nil {
		return err
	}

	// fmt sub-chunk
	if _, err := w.Write([]byte("fmt ")); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(16)); err != nil { // Sub-chunk size
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(1)); err != nil { // Audio format (PCM)
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(channels)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(sampleRate)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(sampleRate*channels*2)); err != nil { // Byte rate
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(channels*2)); err != nil { // Block align
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int16(16)); err != nil { // Bits per sample
		return err
	}

	// data sub-chunk
	if _, err := w.Write([]byte("data")); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, int32(dataSize)); err != nil {
		return err
	}

	return nil
}

// GetDuration returns the duration of the recorded audio
func (r *Recorder) GetDuration() time.Duration {
	r.mu.Lock()
	defer r.mu.Unlock()

	samples := len(r.buffer)
	seconds := float64(samples) / float64(sampleRate)
	return time.Duration(seconds * float64(time.Second))
}

// IsRecording returns whether the recorder is currently recording
func (r *Recorder) IsRecording() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.recording
}
