import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIRA 镜语 — 历史与动漫人格模拟器",
  description:
    "与霍去病、孔子、王阳明、皮卡丘等不同人格展开沉浸对话的高保真产品原型。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
