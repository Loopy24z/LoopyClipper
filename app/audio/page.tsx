import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import AudioStudio from './studio';
import './audio.css';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getCurrentUser();if(!user)redirect('/login');return <AudioStudio owner={user.userId}/>;}
