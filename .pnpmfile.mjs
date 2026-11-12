// pnpm runs this hook before the first install, when project dependencies are unavailable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const profileDirectory = path.join(root, '.omnitron', 'dev-sdk');

// Shared with the SDK selector: a directory must contain the actual public
// framework package, not an alias, a private workspace or an unversioned stub.
export function frameworkPackage(name, directory, expectedVersion) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (!/^@omnitron-dev\/[a-z0-9-]+$/.test(name) || manifest.name !== name || manifest.private ||
      typeof manifest.version !== 'string' ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.test(manifest.version) ||
      expectedVersion !== undefined && manifest.version !== expectedVersion)
    throw Error('Invalid Omnitron SDK package identity for ' + name);
  return manifest;
}

export function developmentPackages() {
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(path.join(profileDirectory, 'install.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  if (profile.schema !== 1 || profile.root !== root || !path.isAbsolute(profile.source))
    throw Error('Invalid Omnitron development SDK selection');
  for (const [name, directory] of Object.entries(profile.links)) {
    if (!/^@omnitron-dev\/[a-z0-9-]+$/.test(name) || !path.isAbsolute(directory) ||
        !directory.startsWith(profile.source + path.sep) || fs.realpathSync(directory) !== directory)
      throw Error('Invalid Omnitron SDK package location for ' + name);
    frameworkPackage(name, directory, profile.versions?.[name]);
  }
  return profile.links;
}

export const hooks = {
  updateConfig(config) {
    const links = Object.entries(developmentPackages());
    if (!links.length) return config;
    // pnpm resolves workspace overrides from lockfileDir. Importers keep their own base.
    const overrides = Object.fromEntries(Object.entries(config.overrides ?? {}).map(([selector, specifier]) => {
      const local = typeof specifier === 'string' && /^(file:|link:)(.+)$/.exec(specifier);
      if (!local || path.isAbsolute(local[2])) return [selector, specifier];
      return [selector, local[1] + path.resolve(root, local[2]).split(path.sep).join('/')];
    }));
    for (const [name, directory] of links) overrides[name] = 'link:' + directory;
    return { ...config, lockfileDir: profileDirectory, overrides };
  },
};
