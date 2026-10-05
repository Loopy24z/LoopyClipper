import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import UgcStudio from './studio';
import './ugc.css';
export const dynamic='force-dynamic';
export default async function Page(){if(!await getCurrentUser())redirect('/login');return <UgcStudio/>;}
