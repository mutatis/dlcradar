import "./globals.css";

export const metadata = {
  title: "DLC Radar",
  description: "Siga jogos da Steam e descubra quando novas DLCs aparecem.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
