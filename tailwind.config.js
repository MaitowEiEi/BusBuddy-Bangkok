/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Noto Sans Thai"', '"Sukhumvit Set"', 'Thonburi', '"Leelawadee UI"', 'Tahoma', 'system-ui', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#effcfa',
                    100: '#cff7f0',
                    200: '#9fede1',
                    300: '#64dccb',
                    400: '#2fc2b0',
                    500: '#15a596',
                    600: '#0d857a',
                    700: '#0f6b63',
                    800: '#115550',
                    900: '#124743',
                },
                ink: { DEFAULT: '#0f172a', soft: '#334155', muted: '#64748b' },
            },
            boxShadow: {
                sheet: '0 -8px 24px -12px rgba(15, 23, 42, 0.25)',
            },
        },
    },
    plugins: [],
};