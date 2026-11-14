import {
  creaProgettoDepositoMarci,
  creaProgettoEdificioDirezionale,
  LIBRERIA_COMPONENTI_DEFAULT,
  TEMPLATE_DXF_PREDEFINITO,
} from '../data/rulesAndLibrary';
import {
  ComponenteLibreria,
  ProgettoAntincendio,
  TemplateTavolaDXF,
} from '../types/elettrocad';

const KEY_PROJECTS = 'elettrocad_fire_projects_v1';
const KEY_ACTIVE_ID = 'elettrocad_fire_active_project_v1';
const KEY_TEMPLATES = 'elettrocad_fire_templates_v1';
const KEY_LIBRARY = 'elettrocad_fire_library_v1';

export function loadProjects(): ProgettoAntincendio[] {
  try {
    const raw = localStorage.getItem(KEY_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw) as ProgettoAntincendio[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  const initial = [creaProgettoEdificioDirezionale(), creaProgettoDepositoMarci()];
  saveProjects(initial);
  return initial;
}

export function saveProjects(projects: ProgettoAntincendio[]) {
  try {
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(projects));
  } catch {
    // ignore quota errors
  }
}

export function loadActiveProjectId(fallbackId: string): string {
  try {
    return localStorage.getItem(KEY_ACTIVE_ID) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function saveActiveProjectId(id: string) {
  try {
    localStorage.setItem(KEY_ACTIVE_ID, id);
  } catch {
    // ignore
  }
}

export function loadTemplates(): TemplateTavolaDXF[] {
  try {
    const raw = localStorage.getItem(KEY_TEMPLATES);
    if (raw) {
      const parsed = JSON.parse(raw) as TemplateTavolaDXF[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [TEMPLATE_DXF_PREDEFINITO];
}

export function saveTemplates(templates: TemplateTavolaDXF[]) {
  try {
    localStorage.setItem(KEY_TEMPLATES, JSON.stringify(templates));
  } catch {
    // ignore
  }
}

export function loadLibrary(): ComponenteLibreria[] {
  try {
    const raw = localStorage.getItem(KEY_LIBRARY);
    if (raw) {
      const parsed = JSON.parse(raw) as ComponenteLibreria[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return LIBRERIA_COMPONENTI_DEFAULT;
}

export function saveLibrary(items: ComponenteLibreria[]) {
  try {
    localStorage.setItem(KEY_LIBRARY, JSON.stringify(items));
  } catch {
    // ignore
  }
}
