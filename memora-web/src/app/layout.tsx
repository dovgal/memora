import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppProvider from "@/components/AppProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import OfflineBanner from "@/components/OfflineBanner";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Memora - Smart Flashcards",
  description: "Master anything with smart spaced repetition",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const token = (session as { id_token?: string } | null)?.id_token || "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Режим для электронных чернил решается ДО первой отрисовки:
              // иначе страница успевает мигнуть анимациями и размытием, а на
              // медленном экране это лишняя полная перерисовка.
              (function(){
                try {
                  var pref = localStorage.getItem('memora.eink');
                  var slow = window.matchMedia && window.matchMedia('(update: slow)').matches;
                  var on = pref ? pref === 'on' : !!slow;
                  document.documentElement.setAttribute('data-eink', on ? 'on' : 'off');
                } catch (e) {}
              })();
              if(typeof navigator !== 'undefined' && 'serviceWorker' in navigator) { 
                navigator.serviceWorker.getRegistrations().then(function(r) { 
                  r.forEach(function(reg) { reg.unregister(); }); 
                }); 
              }
              window.__API_TOKEN__ = "${token}";
              const origFetch = window.fetch;
              window.fetch = async function(...args) {
                let resource = args[0];
                let config = args[1];
                let urlString = typeof resource === 'string' ? resource : (resource instanceof URL ? resource.toString() : null);
                
                if (!urlString && resource && resource.url) {
                    urlString = resource.url;
                }
                
                if (urlString && urlString.includes('/api/') && !urlString.includes('/api/auth')) {
                  config = config || {};
                  let headers = new Headers(config.headers);
                  
                  if (resource && resource.headers) {
                      const resHeaders = new Headers(resource.headers);
                      resHeaders.forEach(function(v, k) { headers.set(k, v); });
                  }
                  
                  if (window.__API_TOKEN__ && !headers.has('Authorization')) {
                      headers.set('Authorization', 'Bearer ' + window.__API_TOKEN__);
                  }
                  config.headers = headers;
                  
                  if (typeof resource !== 'string' && !(resource instanceof URL)) {
                      resource = urlString;
                  }
                  return origFetch(resource, config);
                }
                return origFetch(...args);
              };
            `
          }}
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${geistMono.variable} font-sans antialiased bg-qz-bg`}
      >
        <AppProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <OfflineBanner />
            {children}
          </ThemeProvider>
        </AppProvider>
      </body>
    </html>
  );
}
