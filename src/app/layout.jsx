import './globals.css';
import Header from '@/components/Header';
import Toast from '@/components/Toast';

export const metadata = {
  title: 'KidCanvas — 우리 아이 그림 작품집',
  description: '아이가 그린 그림을 사진으로 찍어 업로드하면, AI가 작품 해설을 생성하고 미술관 도록 스타일의 프리미엄 하드커버 포토북으로 제작합니다.',
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
