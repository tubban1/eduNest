'use client';

import { useState } from 'react';
import type { RadarReview } from '@/lib/types';
import { UserCheck, CheckCircle2, MessageSquare, AlertCircle, ShieldAlert } from 'lucide-react';

interface ReviewSectionProps {
  signalId: string;
  initialReviews: RadarReview[];
}

export function ReviewSection({ signalId, initialReviews }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<RadarReview[]>(initialReviews);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerRole, setReviewerRole] = useState('PHBern Educator / Researcher');
  const [educationalRelevance, setEducationalRelevance] = useState<'high' | 'medium' | 'low' | 'questionable'>('high');
  const [evidenceJudgement, setEvidenceJudgement] = useState<'conclusive' | 'preliminary' | 'insufficient' | 'disputed'>('preliminary');
  const [transferability, setTransferability] = useState<'direct' | 'with_adaptations' | 'low' | 'not_recommended'>('with_adaptations');
  const [notes, setNotes] = useState('');
  const [submittedFeedback, setSubmittedFeedback] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    const newReview: RadarReview = {
      id: `rev-client-${Date.now()}`,
      signal_id: signalId,
      reviewer_name: reviewerName.trim() || 'Anonymous PHBern Reviewer',
      reviewer_role: reviewerRole,
      educational_relevance: educationalRelevance,
      evidence_judgement: evidenceJudgement,
      transferability: transferability,
      notes: notes.trim(),
      created_at: new Date().toISOString()
    };

    setReviews([newReview, ...reviews]);
    setNotes('');
    setFormOpen(false);
    setSubmittedFeedback(true);
    setTimeout(() => setSubmittedFeedback(false), 5000);
  };

  return (
    <section className="profile-review-dossier">
      <div className="review-dossier-head">
        <div>
          <div className="section-eyebrow">HUMAN VALIDATION LAYER</div>
          <h3 className="section-title">Practitioner & Expert Peer Reviews</h3>
          <p className="section-desc">
            Evaluations by PHBern researchers, school leaders, and canton educators assessing actual 
            classroom feasibility and evidence rigor.
          </p>
        </div>

        {!formOpen && (
          <button
            type="button"
            className="inst-action-btn"
            onClick={() => setFormOpen(true)}
          >
            <UserCheck size={14} />
            <span>Add Practitioner Evaluation</span>
          </button>
        )}
      </div>

      {submittedFeedback && (
        <div className="review-success-banner">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>Evaluation added to browser state only; it is not persisted. Database synchronization with <code>radar_reviews</code> is intentionally disabled in this demonstrator.</span>
        </div>
      )}

      {/* Review Form Drawer */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="review-submission-form">
          <div className="form-head">
            <h4>Submit Practitioner Evaluation (PHBern / Lehrperson)</h4>
            <button
              type="button"
              className="text-muted-btn"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </button>
          </div>

          <div className="form-grid-3">
            <div className="form-field">
              <label>Reviewer Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="e.g. Dr. A. Keller"
                className="inst-input"
              />
            </div>

            <div className="form-field">
              <label>Institutional Role</label>
              <input
                type="text"
                value={reviewerRole}
                onChange={(e) => setReviewerRole(e.target.value)}
                placeholder="e.g. PHBern Fachdidaktik / Schulleitung"
                className="inst-input"
              />
            </div>

            <div className="form-field">
              <label>Educational Relevance</label>
              <select
                value={educationalRelevance}
                onChange={(e) => setEducationalRelevance(e.target.value as any)}
                className="inst-select"
              >
                <option value="high">High — Solves Core Problem</option>
                <option value="medium">Medium — Incremental Benefit</option>
                <option value="low">Low — Peripheral Utility</option>
                <option value="questionable">Questionable — Potential Distraction</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label>Evidence Judgement</label>
              <select
                value={evidenceJudgement}
                onChange={(e) => setEvidenceJudgement(e.target.value as any)}
                className="inst-select"
              >
                <option value="conclusive">Conclusive Empirical Evidence</option>
                <option value="preliminary">Preliminary / Promising Field Pilot</option>
                <option value="insufficient">Insufficient Data / Anecdotal Only</option>
                <option value="disputed">Disputed / Methodologically Flawed</option>
              </select>
            </div>

            <div className="form-field">
              <label>Transferability to Swiss Context</label>
              <select
                value={transferability}
                onChange={(e) => setTransferability(e.target.value as any)}
                className="inst-select"
              >
                <option value="direct">Direct Transfer Possible</option>
                <option value="with_adaptations">Viable With Curricular Adaptations</option>
                <option value="low">Low Compatibility With Lehrplan 21</option>
                <option value="not_recommended">Not Recommended For Swiss Compulsory School</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Field Notes, Pedagogical Reservations & Contextual Observations</label>
            <textarea
              rows={4}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail your assessment of teacher workload, data privacy considerations, alignment with cantonal syllabus, or prerequisite student competencies..."
              className="inst-textarea"
            />
          </div>

          <div className="form-submit-row">
            <span className="form-note">
              No account required for demonstrator. This preview is not persisted.
            </span>
            <button type="submit" className="inst-action-btn primary">
              Record Evaluation
            </button>
          </div>
        </form>
      )}

      {/* Review History Cards */}
      <div className="review-cards-list">
        {reviews.length > 0 ? (
          reviews.map((rev) => (
            <article key={rev.id} className="review-record-card">
              <div className="record-header">
                <div className="reviewer-info">
                  <span className="reviewer-avatar">
                    <UserCheck size={14} />
                  </span>
                  <div>
                    <h5 className="reviewer-name">{rev.reviewer_name || 'Anonymous Reviewer'}</h5>
                    <span className="reviewer-role">{rev.reviewer_role || 'Educational Specialist'}</span>
                  </div>
                </div>

                <div className="record-badges">
                  <span className={`pill-eval rel-${rev.educational_relevance}`}>
                    Relevance: {rev.educational_relevance}
                  </span>
                  <span className={`pill-eval ev-${rev.evidence_judgement}`}>
                    Evidence: {rev.evidence_judgement}
                  </span>
                  <span className={`pill-eval tr-${rev.transferability}`}>
                    Transfer: {rev.transferability.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="record-notes">
                <p>{rev.notes}</p>
              </div>

              <div className="record-footer">
                <span className="record-date">
                  Recorded: {new Date(rev.created_at || Date.now()).toLocaleDateString()}
                </span>
                <span className="record-sync">Schema: radar_reviews</span>
              </div>
            </article>
          ))
        ) : (
          <div className="review-empty-state">
            <p>No expert evaluations filed yet for this signal. Qualified educators may contribute above.</p>
          </div>
        )}
      </div>
    </section>
  );
}
