import './globals.css';
import Header from '@/components/Header';
import Toast from '@/components/Toast';

export const metadata = {
  title: 'ARCHIVE — Premium Project Portfolio Book',
  description: '당신의 프로젝트와 1년의 성과를 한 권의 프리미엄 아카이브로. SweetBook Book Print API 기반 포트폴리오 북 제작 플랫폼.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <Header />
        <Toast />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
