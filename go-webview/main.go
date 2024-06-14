package main

/*
#cgo linux pkg-config: webkit2gtk-4.0
#include <webkit2/webkit2.h>
*/
import "C"
import (
	"flag"
	"fmt"
	webview "github.com/webview/webview_go"
)

func createWebview() {
	url := flag.String("app", "", "URL to open in webview")
	web_context := C.webkit_web_context_get_default()
	data_manager := C.webkit_web_context_get_website_data_manager(web_context)
	C.webkit_website_data_manager_set_tls_errors_policy(data_manager, C.WEBKIT_TLS_ERRORS_POLICY_IGNORE)
	flag.Parse()

	fmt.Print(*url)
	w := webview.New(false)
	defer w.Destroy()
	w.SetTitle("CF Solver")
	w.SetSize(800, 600, webview.HintNone)
	w.Navigate(*url)
	w.Run()
}

func main() {
	createWebview()
}
