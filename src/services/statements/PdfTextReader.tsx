import { useEffect, useImperativeHandle, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

import type { StatementPages } from '../../domain/statements/types';
import { loadNative } from '../loadNative';
import { PDF_READER_HTML } from './pdfReaderHtml';

export type PdfReadResult =
  | { type: 'pages'; pages: StatementPages }
  | { type: 'needs-password' }
  | { type: 'wrong-password' };

export interface PdfTextReaderHandle {
  /** Reads the text of every page; `password` opens protected PDFs. */
  read(base64: string, password: string): Promise<PdfReadResult>;
}

type Message = { type: 'ready' } | ({ id: number } & (PdfReadResult | { type: 'error'; message: string }));

type WebViewHandle = { injectJavaScript(script: string): void };
type WebViewComponent = ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

/**
 * An invisible WebView running PDF.js, which reads statement PDFs on the
 * phone. Its page allows no network access and no navigation.
 */
export function PdfTextReader({ ref, onError }: { ref: Ref<PdfTextReaderHandle>; onError: (error: Error) => void }) {
  const [WebView, setWebView] = useState<WebViewComponent | null>(null);
  const webView = useRef<WebViewHandle>(null);
  const [ready] = useState(() => {
    let resolve = () => {};
    const promise = new Promise<void>(done => {
      resolve = done;
    });
    return { promise, resolve };
  });
  const pending = useRef(new Map<number, { resolve: (result: PdfReadResult) => void; reject: (error: Error) => void }>());
  const nextId = useRef(1);

  useEffect(() => {
    loadNative(() => import('react-native-webview'), 'Statement import')
      .then(module => setWebView(() => module.WebView as unknown as WebViewComponent))
      .catch(onError);
  }, [onError]);

  useImperativeHandle(ref, () => ({
    async read(base64, password) {
      await ready.promise;
      const id = nextId.current++;
      return new Promise<PdfReadResult>((resolve, reject) => {
        pending.current.set(id, { resolve, reject });
        webView.current?.injectJavaScript(
          `window.readPdf(${id}, ${JSON.stringify(base64)}, ${JSON.stringify(password)}); true;`,
        );
      });
    },
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    const message = JSON.parse(event.nativeEvent.data) as Message;
    if (message.type === 'ready') {
      ready.resolve();
      return;
    }
    const request = pending.current.get(message.id);
    pending.current.delete(message.id);
    if (message.type === 'error') {
      request?.reject(new Error(`This PDF could not be read (${message.message}).`));
    } else {
      request?.resolve(message);
    }
  };

  if (!WebView) {
    return null;
  }
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webView}
        source={{ html: PDF_READER_HTML }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={request => /^(about:|data:)/.test(request.url)}
        onMessage={onMessage}
        javaScriptEnabled
        cacheEnabled={false}
        incognito
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        style={styles.hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
