import { NextResponse } from 'next/server';
import { uploadPhoto, listPhotos } from '@/lib/sweetbook';

// GET /api/books/[bookUid]/photos — 사진 목록
export async function GET(request, { params }) {
  try {
    const { bookUid } = await params;
    const result = await listPhotos(bookUid);
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET photos 상세 에러:', err.response?.data || err.message || err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

// POST /api/books/[bookUid]/photos — 사진 업로드
export async function POST(request, { params }) {
  try {
    const { bookUid } = await params;
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, message: '파일이 필요합니다' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadPhoto(bookUid, buffer, file.name);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST photos 상세 에러:', err.response?.data || err.message || err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
