'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageCircle, Mail } from 'lucide-react';

export interface NotificationChannels {
    telegram: boolean;
    line: boolean;
    email: boolean;
}

interface NotificationChannelsSelectorProps {
    value: NotificationChannels;
    onChange: (channels: NotificationChannels) => void;
    disabled?: boolean;
}

/**
 * Reusable notification channel selector component
 * Used in both News Alerts and Market Alerts pages
 */
export function NotificationChannelsSelector({
    value,
    onChange,
    disabled = false,
}: NotificationChannelsSelectorProps) {
    const handleChange = (channel: keyof NotificationChannels, checked: boolean) => {
        onChange({ ...value, [channel]: checked });
    };

    return (
        <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                    checked={value.telegram}
                    onCheckedChange={(v) => handleChange('telegram', v)}
                    disabled={disabled}
                />
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Telegram</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                    checked={value.line}
                    onCheckedChange={(v) => handleChange('line', v)}
                    disabled={disabled}
                />
                <MessageCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">LINE</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                    checked={value.email}
                    onCheckedChange={(v) => handleChange('email', v)}
                    disabled={disabled}
                />
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Email</span>
            </label>
        </div>
    );
}

/**
 * Display-only version showing active channels as icons
 */
export function NotificationChannelsDisplay({ channels }: { channels: NotificationChannels }) {
    return (
        <div className="flex items-center gap-2">
            {channels.telegram && <MessageCircle className="h-4 w-4 text-blue-500" />}
            {channels.line && <MessageCircle className="h-4 w-4 text-green-500" />}
            {channels.email && <Mail className="h-4 w-4 text-gray-500" />}
        </div>
    );
}
