import type { Metadata } from "next";
import { Noto_Sans_Thai, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const noto = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-noto",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = String(settings["site.name"] ?? "NEXTGEN GAME STORE");
  const description = String(settings["site.description"] ?? "");
  return {
    title: { default: name, template: `%s · ${name}` },
    description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    openGraph: { title: name, description, type: "website" },
    robots: { index: true, follow: true },
  };
}

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ngs-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${noto.variable} ${sora.variable} min-h-screen bg-bg text-fg antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast: "!bg-card !text-fg !border !border-border !rounded-xl !shadow-lg",
                description: "!text-muted",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
