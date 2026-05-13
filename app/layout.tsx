import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aluta",
  description: "Practice the panic. Pass the panel.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script src="https://cdn.tailwindcss.com" async={false}></script>
      </body>
    </html>
  );
}
