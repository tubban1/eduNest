import {NextResponse} from 'next/server';
import {listSignals} from '@/lib/radar';
export async function GET(){return NextResponse.json({signals:await listSignals(100)})}
