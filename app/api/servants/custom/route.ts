import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ServantTemplate } from '@/lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'custom_servants.json');

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStoredCustomServants(): ServantTemplate[] {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(FILE_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading custom_servants.json:', err);
    return [];
  }
}

function writeStoredCustomServants(servants: ServantTemplate[]): boolean {
  try {
    ensureDataDirectory();
    fs.writeFileSync(FILE_PATH, JSON.stringify(servants, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing custom_servants.json:', err);
    return false;
  }
}

export async function GET() {
  const servants = readStoredCustomServants();
  return NextResponse.json({ success: true, servants });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, servant, servants, servantId } = body;

    let current = readStoredCustomServants();

    if (action === 'save_all' && Array.isArray(servants)) {
      current = servants;
      writeStoredCustomServants(current);
      return NextResponse.json({ success: true, count: current.length, servants: current });
    }

    if (action === 'add' || action === 'upsert') {
      if (!servant || !servant.id) {
        return NextResponse.json({ success: false, error: 'Invalid servant payload' }, { status: 400 });
      }
      const existingIdx = current.findIndex(s => s.id === servant.id);
      if (existingIdx >= 0) {
        current[existingIdx] = servant;
      } else {
        current.push(servant);
      }
      writeStoredCustomServants(current);
      return NextResponse.json({ success: true, servant, count: current.length });
    }

    if (action === 'delete') {
      if (!servantId) {
        return NextResponse.json({ success: false, error: 'Servant ID is required' }, { status: 400 });
      }
      current = current.filter(s => s.id !== servantId);
      writeStoredCustomServants(current);
      return NextResponse.json({ success: true, deletedId: servantId, count: current.length });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
