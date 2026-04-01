import ServiceCard from '@/components/ServiceCard';
import { SERVICE_TYPES } from '@/lib/constants';

export default function HomePage() {
  const services = Object.values(SERVICE_TYPES);

  return (
    <div className="min-h-screen">
      {/* 히어로 섹션 */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-warm-50 to-cream" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-warm-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-warm-200/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <p className="text-warm-600 font-medium tracking-wider text-sm mb-4 opacity-0 animate-fade-up">
            BOOK PRINT API POWERED
          </p>
          <h1 className="font-display font-black text-4xl md:text-6xl text-ink-900 leading-tight mb-6 opacity-0 animate-fade-up delay-100">
            나만의 특별한 책을<br />
            손쉽게 만들어 보세요
          </h1>
          <p className="text-ink-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto opacity-0 animate-fade-up delay-200">
            육아 일기, 여행 포토북, AI 동화책까지.<br />
            소중한 순간을 세상에 하나뿐인 책으로 만들어 드립니다.
          </p>
        </div>
      </section>

      {/* 서비스 선택 그리드 */}
      <section className="max-w-6xl mx-auto px-6 pb-24 -mt-4">
        <h2 className="font-display font-bold text-2xl text-ink-900 text-center mb-2">
          어떤 책을 만들까요?
        </h2>
        <p className="text-ink-400 text-center mb-10">
          만들고 싶은 서비스를 선택하세요
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <ServiceCard key={service.key} service={service} index={i} />
          ))}
        </div>
      </section>

      {/* 이용 흐름 안내 */}
      <section className="bg-white border-t border-ink-100 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-display font-bold text-2xl text-ink-900 text-center mb-12">
            이렇게 만들어져요
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', icon: '🎯', title: '서비스 선택', desc: '원하는 포토북 유형을 선택합니다' },
              { step: '02', icon: '✏️', title: '정보 입력', desc: '서비스에 맞는 정보를 입력합니다' },
              { step: '03', icon: '📸', title: '콘텐츠 편집', desc: '사진과 텍스트로 페이지를 구성합니다' },
              { step: '04', icon: '📦', title: '주문 완료', desc: '배송 정보 입력 후 주문합니다' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-warm-50 rounded-2xl flex items-center justify-center text-2xl">
                  {item.icon}
                </div>
                <p className="text-warm-600 text-xs font-medium mb-1">STEP {item.step}</p>
                <h3 className="font-display font-bold text-ink-900 mb-2">{item.title}</h3>
                <p className="text-sm text-ink-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-ink-100 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-ink-400">
          <p>북메이커 BookMaker — Powered by <a href="https://api.sweetbook.com" className="text-warm-600 hover:underline" target="_blank" rel="noopener noreferrer">SweetBook Book Print API</a></p>
          <p className="mt-1">© 2026 BookMaker. 스위트북 바이브코딩 과제</p>
        </div>
      </footer>
    </div>
  );
}
