import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/persons - Return contacts and friends for custody assignment
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    // 1. Fetch user's friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: user.id }, { user2Id: user.id }],
      },
      include: {
        user1: { select: { id: true, name: true, email: true, username: true } },
        user2: { select: { id: true, name: true, email: true, username: true } },
      },
    });

    const friendPersons = friendships.map((f) => {
      const target = f.user1Id === user.id ? f.user2 : f.user1;
      return {
        id: target.id,
        name: `${target.name} (@${target.username})`,
        email: target.email,
        phone: null,
      };
    });

    // 2. Fetch recent distinct contacts from user's borrow/lend records
    const [borrows, lends] = await Promise.all([
      prisma.borrowRecord.findMany({
        where: { userId: user.id },
        select: { borrowedFrom: true },
        distinct: ['borrowedFrom'],
      }),
      prisma.lendRecord.findMany({
        where: { userId: user.id },
        select: { lentTo: true },
        distinct: ['lentTo'],
      }),
    ]);

    const distinctNames = new Set<string>();
    borrows.forEach((b) => b.borrowedFrom && distinctNames.add(b.borrowedFrom));
    lends.forEach((l) => l.lentTo && distinctNames.add(l.lentTo));

    const pastContacts = Array.from(distinctNames).map((name) => ({
      id: name,
      name,
      email: null,
      phone: null,
    }));

    // Combine and deduplicate
    const combined = [...friendPersons, ...pastContacts];

    return NextResponse.json({
      persons: combined,
      data: combined,
      total: combined.length,
    });
  } catch (error) {
    console.error('Error fetching persons:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST /api/persons - Add a quick contact name
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;

    const body = await request.json();
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
    }

    const contact = {
      id: name,
      name,
      email: body.email || null,
      phone: body.phone || null,
    };

    return NextResponse.json({ person: contact, ...contact }, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
