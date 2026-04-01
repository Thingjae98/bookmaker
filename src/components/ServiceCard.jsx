'use client';

import Link from 'next/link';

export default function ServiceCard({ service, index }) {
  return (
    <Link
      href={`/create/${service.key}`}
      className="card-hover block bg-white rounded-2xl overflow-hidden border border-ink-100 opacity-0 animate-fade-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className={`h-36 bg-gradient-to-br ${service.color} flex items-center justify-center`}>
        <span className="text-6xl">{service.icon}</span>
      </div>
      <div className="p-6">
        <h3 className="font-display font-bold text-lg text-ink-900 mb-1">{service.name}</h3>
        <p className="text-sm text-warm-600 font-medium mb-3">{service.subtitle}</p>
        <p className="text-sm text-ink-400 leading-relaxed line-clamp-2">{service.description}</p>
        <div className="mt-4 flex items-center text-warm-600 text-sm font-medium">
          시작하기
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
