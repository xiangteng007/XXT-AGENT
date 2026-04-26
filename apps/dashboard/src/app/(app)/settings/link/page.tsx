import { redirect } from 'next/navigation';

// /settings/link → redirect to /settings/link-telegram
export default function SettingsLinkPage() {
  redirect('/settings/link-telegram');
}
