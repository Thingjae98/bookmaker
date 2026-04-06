'use client';

import Link from 'next/link';

// ServiceCard — 단일 서비스(archive) 카드. 하위 호환성을 위해 유지하되 B&W 스타일로 변경
export default function ServiceCard({ service, index }) {
  return (
    <Link
      href={`/create/${service.key}`}
      className="card-hover block bg-white border border-neutral-200 overflow-hidden opacity-0 animate-fade-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="h-36 bg-neutral-900 flex items-center justify-center">
        <span className="text-white font-mono text-lg font-bold tracking-wider">ARCHIVE</span>
      </div>
      <div className="p-6">
        <h3 className="font-display font-bold text-lg text-neutral-900 mb-1">{service.name}</h3>
        <p className="text-sm text-neutral-500 font-medium mb-3">{service.subtitle}</p>
        <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">{service.description}</p>
        <div className="mt-4 flex items-center text-neutral-900 text-xs font-mono font-medium tracking-wider uppercase">
          Start
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
