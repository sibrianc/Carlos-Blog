import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CadejoGuardian } from '../components/CadejoGuardian';
import { ProjectsTransmutationStage } from '../components/ProjectsTransmutationStage';
import { api } from '../lib/api';
import type { ProjectSummary } from '../types';

function ArchivalPlate({ project }: { project: ProjectSummary }) {
  return (
    <article
      className="archival-plate"
    >
      <Link to={`/projects/${project.slug}`} className="plate-media">
        {project.videoUrl ? (
          <video autoPlay muted loop playsInline poster={project.coverImage || undefined}>
            <source src={project.videoUrl} type="video/mp4" />
          </video>
        ) : project.coverImage ? (
          <img src={project.coverImage} alt={project.title} />
        ) : (
          <div className="plate-placeholder">No image</div>
        )}
      </Link>
      <div className="plate-inscription">
        <span className="plate-stamp" data-steady-block={`project-${project.id}-stamp`} data-steady-role="meta">
          {statusLabel(project.status)}
          {project.projectYear ? ` / ${project.projectYear}` : ''}
        </span>
        <Link to={`/projects/${project.slug}`}>
          <h2 className="plate-title" data-steady-block={`project-${project.id}-title`} data-steady-role="title">
            {project.title}
          </h2>
        </Link>
        <p className="plate-note" data-steady-block={`project-${project.id}-note`} data-steady-role="body">
          {project.tagline || project.summary}
        </p>
      </div>
    </article>
  );
}

function statusLabel(status: string) {
  if (status === 'beta') return 'Beta';
  if (status === 'archived') return 'Archived';
  return 'Live';
}

export function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const stageSignature = useMemo(
    () => projects.map((project) => `${project.id}:${project.slug}:${project.title}:${project.projectYear}`).join('|'),
    [projects],
  );

  const filters = useMemo(() => ({
    tech: searchParams.get('tech') || '',
    year: searchParams.get('year') || '',
    status: searchParams.get('status') || '',
  }), [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.fetchProjects(filters)
      .then((payload) => {
        if (!active) return;
        setProjects(payload.projects);
        setAvailableYears(payload.availableYears);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load projects.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters]);

  const updateFilter = (key: 'tech' | 'year' | 'status', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  return (
    <div className="portfolio-projects page-frame-wide">
      <CadejoGuardian variant="black" />
      <header className="portfolio-page-heading">
        <p className="portfolio-kicker">Projects Archive</p>
        <h1 className="font-headline text-5xl md:text-7xl italic text-glow text-primary">Projects</h1>
        <p>Selected builds, case studies, and production work folded into the blog without replacing its core.</p>
      </header>

      <section className="portfolio-filter-panel">
        <label>
          <span>Tech</span>
          <input value={filters.tech} onChange={(e) => updateFilter('tech', e.target.value)} placeholder="React, Flask..." />
        </label>
        <label>
          <span>Year</span>
          <select value={filters.year} onChange={(e) => updateFilter('year', e.target.value)}>
            <option value="">All years</option>
            {availableYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">All status</option>
            <option value="live">Live</option>
            <option value="beta">Beta</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button type="button" onClick={() => setSearchParams(new URLSearchParams())}>Reset</button>
      </section>

      {loading ? (
        <div className="portfolio-empty">Loading project archive...</div>
      ) : error ? (
        <div className="portfolio-empty portfolio-error">{error}</div>
      ) : projects.length === 0 ? (
        <div className="portfolio-empty">No projects yet. Add the first one from the admin panel.</div>
      ) : (
        <ProjectsTransmutationStage
          signature={stageSignature}
          className="projects-swarm"
        >
          <section className="projects-grid">
            {projects.map((project) => (
              <ArchivalPlate key={project.id} project={project} />
            ))}
          </section>
        </ProjectsTransmutationStage>
      )}
    </div>
  );
}
