'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ errorInfo });
        this.props.onError?.(error, errorInfo);

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error caught by boundary:', error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex items-center justify-center p-6">
                    <Card className="max-w-md w-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-5 w-5" />
                                發生錯誤
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground">
                                頁面遇到問題，請嘗試重新載入或返回首頁。
                            </p>

                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                                    {this.state.error.message}
                                </pre>
                            )}

                            <div className="flex gap-2">
                                <Button onClick={this.handleRetry} variant="default">
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    重試
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => window.location.href = '/'}
                                >
                                    <Home className="h-4 w-4 mr-2" />
                                    返回首頁
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

// Functional wrapper for easier use
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

// Suspense-like loading fallback
interface SuspenseFallbackProps {
    message?: string;
}

export function SuspenseFallback({ message = '載入中...' }: SuspenseFallbackProps) {
    return (
        <div className="min-h-[200px] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}

// Offline indicator
export function OfflineIndicator() {
    const [isOnline, setIsOnline] = React.useState(true);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
            <Card className="bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700">
                <CardContent className="p-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm text-orange-800 dark:text-orange-200">
                        網路連線中斷，部分功能可能無法使用
                    </span>
                </CardContent>
            </Card>
        </div>
    );
}
