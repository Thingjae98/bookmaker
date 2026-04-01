import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: '북메이커 BookMaker — 나만의 특별한 책을 만드세요',
  description: 'Book Print API를 활용한 맞춤형 포토북 제작 플랫폼. 육아일기, 여행포토북, AI동화책 등 다양한 주제의 책을 손쉽게 만들 수 있습니다.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <Header />
        <main className="pt-16">{children}</main>
      </body>
    </html>
  );
}
