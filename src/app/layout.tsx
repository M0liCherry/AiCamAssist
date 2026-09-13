import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity AI — Local-first AI study workspace",
  description: "Offline-first study and note-taking workspace with podcasts, flashcards, quizzes, and a source-grounded assistant.",
  applicationName: "Verity AI",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141218" },
    { media: "(prefers-color-scheme: light)", color: "#fef7ff" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=Google+Sans+Text:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400;1,500&family=Roboto+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Apply the persisted theme + seed before hydration to avoid a dark/light flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("verity_theme");if(t!=="light"&&t!=="dark")t="dark";var s=localStorage.getItem("verity_seed");if(!/^#[0-9A-Fa-f]{6}$/.test(s||""))s="#6750A4";s=s.toUpperCase();var d=document.documentElement;d.dataset.theme=t;function hx(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}}function th(o){function c(n){return Math.max(0,Math.min(255,Math.round(n)))}function h(n){return c(n).toString(16).padStart(2,"0").toUpperCase()}return"#"+h(o.r)+h(o.g)+h(o.b)}function mx(a,b,w){var ca=hx(a),cb=hx(b);return th({r:ca.r*w+cb.r*(1-w),g:ca.g*w+cb.g*(1-w),b:ca.b*w+cb.b*(1-w)})}function hsl(h){var o=hx(h),rn=o.r/255,gn=o.g/255,bn=o.b/255,mx2=Math.max(rn,gn,bn),mn=Math.min(rn,gn,bn),l=(mx2+mn)/2;if(mx2===mn)return{h:0,s:0,l:l}var dd=mx2-mn,ss=l>.5?dd/(2-mx2-mn):dd/(mx2+mn),hh=0;if(mx2===rn)hh=((gn-bn)/dd+(gn<bn?6:0))/6;else if(mx2===gn)hh=((bn-rn)/dd+2)/6;else hh=((rn-gn)/dd+4)/6;return{h:hh*360,s:ss,l:l}}function h2x(h,s2,l){h=(((h%360)+360)%360)/360;var q=l<.5?l*(1+s2):l+s2-l*s2,p=2*l-q;function ch(tt){if(tt<0)tt+=1;if(tt>1)tt-=1;if(tt<1/6)return p+(q-p)*6*tt;if(tt<1/2)return q;if(tt<2/3)return p+(q-p)*(2/3-tt)*6;return p}return th({r:ch(h+1/3)*255,g:ch(h)*255,b:ch(h-1/3)*255})}function tb(sd){var c=hsl(sd);return h2x(c.h+60,Math.min(1,c.s*.9+.1),Math.min(.55,Math.max(.35,c.l)))}var m=mx(s,"#8A8A8E",.55),tt=tb(s),V=t==="dark"?{"--seed":s,"--md-sys-color-primary":mx(s,"#FFFFFF",.32),"--md-sys-color-on-primary":mx(s,"#000000",.72),"--md-sys-color-primary-container":mx(s,"#000000",.72),"--md-sys-color-on-primary-container":mx(s,"#FFFFFF",.12),"--md-sys-color-inverse-primary":mx(s,"#000000",.85),"--md-sys-color-secondary":mx(m,"#FFFFFF",.3),"--md-sys-color-on-secondary":mx(m,"#000000",.75),"--md-sys-color-secondary-container":mx(m,"#000000",.68),"--md-sys-color-on-secondary-container":mx(m,"#FFFFFF",.12),"--md-sys-color-tertiary":mx(tt,"#FFFFFF",.32),"--md-sys-color-on-tertiary":mx(tt,"#000000",.72),"--md-sys-color-tertiary-container":mx(tt,"#000000",.68),"--md-sys-color-on-tertiary-container":mx(tt,"#FFFFFF",.12),"--md-sys-color-background":mx("#141218",s,.93),"--md-sys-color-surface":mx("#141218",s,.93),"--md-sys-color-surface-dim":mx("#141218",s,.93),"--md-sys-color-surface-bright":mx("#3B383E",s,.88),"--md-sys-color-surface-container-lowest":mx("#0F0D13",s,.94),"--md-sys-color-surface-container-low":mx("#1D1B20",s,.9),"--md-sys-color-surface-container":mx("#211F26",s,.89),"--md-sys-color-surface-container-high":mx("#2B2930",s,.88),"--md-sys-color-surface-container-highest":mx("#36343B",s,.87),"--md-sys-color-surface-variant":mx("#49454F",s,.85)}:{"--seed":s,"--md-sys-color-primary":mx(s,"#000000",.88),"--md-sys-color-on-primary":"#FFFFFF","--md-sys-color-primary-container":mx(s,"#FFFFFF",.18),"--md-sys-color-on-primary-container":mx(s,"#000000",.45),"--md-sys-color-inverse-primary":mx(s,"#FFFFFF",.32),"--md-sys-color-secondary":mx(m,"#000000",.85),"--md-sys-color-on-secondary":"#FFFFFF","--md-sys-color-secondary-container":mx(m,"#FFFFFF",.16),"--md-sys-color-on-secondary-container":mx(m,"#000000",.5),"--md-sys-color-tertiary":mx(tt,"#000000",.85),"--md-sys-color-on-tertiary":"#FFFFFF","--md-sys-color-tertiary-container":mx(tt,"#FFFFFF",.16),"--md-sys-color-on-tertiary-container":mx(tt,"#000000",.5),"--md-sys-color-background":mx("#FEF7FF",s,.96),"--md-sys-color-surface":mx("#FEF7FF",s,.96),"--md-sys-color-surface-dim":mx("#DED8E1",s,.94),"--md-sys-color-surface-bright":"#FEF7FF","--md-sys-color-surface-container-lowest":"#FFFFFF","--md-sys-color-surface-container-low":mx("#F7F2FA",s,.95),"--md-sys-color-surface-container":mx("#F3EDF7",s,.95),"--md-sys-color-surface-container-high":mx("#ECE6F0",s,.94),"--md-sys-color-surface-container-highest":mx("#E6E0E9",s,.93),"--md-sys-color-surface-variant":mx("#E7E0EC",s,.92)};for(var k in V)d.style.setProperty(k,V[k])}catch(e){document.documentElement.dataset.theme="dark"}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
