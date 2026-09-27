import Studio from './studio';
import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Home(){if(!await getCurrentUser())redirect('/login');return <Studio/>}
