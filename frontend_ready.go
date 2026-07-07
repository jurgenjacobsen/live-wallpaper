package main

import (
	"fmt"
	"sync"
)

type frontendReadyState struct {
	mu    sync.RWMutex
	ready map[string]bool
}

func newFrontendReadyState() *frontendReadyState {
	return &frontendReadyState{ready: make(map[string]bool)}
}

func readyKey(provider wallpaperProvider, monitorIndex int) string {
	return fmt.Sprintf("%s:%d", provider, monitorIndex)
}

func (s *frontendReadyState) MarkReady(provider wallpaperProvider, monitorIndex int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ready[readyKey(provider, monitorIndex)] = true
}

func (s *frontendReadyState) Reset(provider wallpaperProvider, monitorIndex int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.ready, readyKey(provider, monitorIndex))
}

func (s *frontendReadyState) IsReady(provider wallpaperProvider, monitorIndex int) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ready[readyKey(provider, monitorIndex)]
}
