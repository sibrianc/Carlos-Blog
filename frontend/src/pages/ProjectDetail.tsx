import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { ProjectSummary } from '../types';

export function ProjectDetail() {
  const { slug = '' } = useParams();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.fetchProject(slug)
      .then((payload) => {
        if (!active) return;
        setProject(payload.project);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Project not found.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return <div className="portfolio-empty page-frame">Loading project...</div>;
  }

  if (error || !project) {
    return (
      <div className="portfolio-empty page-frame">
        <p>{error || 'Project not found.'}</p>
        <Link to="/projects" className="portfolio-link">Return to Projects</Link>
      </div>
    );
  }

  return (
    <article className="dossier page-frame-wide">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="dossier-header"
      >
        <Link to="/projects" className="dossier-back">← Archive</Link>
        <span className="dossier-stamp">
          {(project.status || 'live').toUpperCase()}
          {project.projectYear ? ` / ${project.projectYear}` : ''}
          {project.roleLabel ? ` / ${project.roleLabel}` : ''}
        </span>
        <h1 className="dossier-title">{project.title}</h1>
        <p className="dossier-lead">{project.tagline || project.summary}</p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="dossier-specimen"
      >
        {project.videoUrl ? (
          <video controls autoPlay muted loop playsInline poster={project.coverImage || undefined}>
            <source src={project.videoUrl} type="video/mp4" />
          </video>
        ) : project.coverImage ? (
          <img src={project.coverImage} alt={project.title} />
        ) : (
          <div className="portfolio-missing-media">No visual data</div>
        )}
      </motion.div>

      <div className="dossier-narrative">
        <DossierSection title="Context" text={project.tagline || project.summary} delay={0.1} />
        <DossierSection title="Challenge" text={project.problem || project.summary} delay={0.2} />
        <DossierSection title="Solution" text={project.summary} delay={0.3} />
        <DossierSection title="Impact" text={project.outcome || project.tagline} delay={0.4} />
        <DossierSection title="Implementation" text={project.description || project.summary} multiline delay={0.45} />
      </div>

      <aside className="dossier-colophon">
        <h2>Stack</h2>
        <ul>
          {project.techStack.map((tech) => <li key={tech}>{tech}</li>)}
        </ul>
        <div className="dossier-links">
          {project.liveUrl && <a href={project.liveUrl} target="_blank" rel="noreferrer">Live ↗</a>}
          {project.repoUrl && <a href={project.repoUrl} target="_blank" rel="noreferrer">Source ↗</a>}
        </div>
      </aside>
    </article>
  );
}

function DossierSection({ delay = 0, multiline = false, text, title }: { delay?: number; multiline?: boolean; text: string; title: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className="dossier-section"
    >
      <h2>{title}</h2>
      {multiline ? (
        <div>
          {(text || 'Pending details.').split('\n').map((line, i) => <p key={i}>{line}</p>)}
        </div>
      ) : (
        <p>{text || 'Pending details.'}</p>
      )}
    </motion.section>
  );
}
