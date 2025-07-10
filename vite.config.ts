import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig((command) => ({
	plugins: [
		tailwindcss(),
		sveltekit(),
		command.command === 'build' && viteSingleFile({ removeViteModuleLoader: true }),
	],
	build: { minify: true },
	server: {
		allowedHosts: ['localhost', 'mba-zelda', 'mba-zelda.local'],
	}
}));
