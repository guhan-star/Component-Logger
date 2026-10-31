import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Endpoint migrated. Use /api/projects/[id]/bom' }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: 'Endpoint migrated. Use /api/projects/[id]/bom' }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Endpoint migrated. Use /api/projects/[id]/bom' }, { status: 404 });
}
