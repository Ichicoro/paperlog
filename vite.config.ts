import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
	plugins: [
		tailwindcss(),
		svelte(),
	],
	root: import.meta.dir,
	fastify: {
		clientModule: 'src/main.ts',
		paths: {
			root: import.meta.path,
		}
	},
	build: {
		minify: true,
		outDir: 'dist'
	},
	server: {
		allowedHosts: ['localhost', 'mba-zelda', 'mba-zelda.local'],
	}
}));
