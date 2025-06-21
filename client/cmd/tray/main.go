package main

import (
	"context"

	"github.com/chtushar/swear-by-sheets/client/tray"
)

func main() {
	t := tray.New()
	t.Startup(context.Background())
}
