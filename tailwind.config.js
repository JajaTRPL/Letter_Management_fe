/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Aligned with `teal-700`, which ~72 sites already use directly.
                // Changing the token is one edit; repainting those sites is 72.
                'primary-teal': '#0f766e',
                'secondary-teal': '#008080',
                'bg-dark': '#002d2d',
            },
        },
    },
    plugins: [],
}
