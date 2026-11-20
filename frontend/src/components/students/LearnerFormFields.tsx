import { ALLOWED_GRADES, getLearnerSchoolYearOptions, STUDENT_STATUS_OPTIONS } from '../../lib/constants';
import type { LearnerFormInput, ParentInput } from '../../types/database';

interface LearnerFormFieldsProps {
  prefix: string;
  value: LearnerFormInput;
  onChange: (next: LearnerFormInput) => void;
  sectionsForGrade: string[];
}

export function emptyParentInput(): ParentInput {
  return {
    id: null,
    full_name: '',
    relationship: '',
    mobile_number: '',
    telephone_number: '',
    email_address: '',
    home_address: '',
    workplace: '',
    workplace_address: '',
    emergency_contact_number: '',
  };
}

export function emptyLearnerFormInput(): LearnerFormInput {
  const years = getLearnerSchoolYearOptions();
  return {
    full_name: '',
    lrn: '',
    grade_level: '',
    section: '',
    school_year: years[0] ?? '2024-2025',
    date_of_birth: '',
    home_address: '',
    blood_type: '',
    allergies: '',
    medications: '',
    status: 'Unknown / Not Indicated',
    reunification_contacts: [],
    primary_parent: emptyParentInput(),
    secondary_parent: emptyParentInput(),
  };
}

export function LearnerFormFields({
  prefix,
  value,
  onChange,
  sectionsForGrade,
}: LearnerFormFieldsProps) {
  const baseSchoolYears = getLearnerSchoolYearOptions();
  const schoolYears =
    value.school_year && !baseSchoolYears.includes(value.school_year)
      ? [value.school_year, ...baseSchoolYears]
      : baseSchoolYears;
  const availableSections =
    value.section && !sectionsForGrade.includes(value.section)
      ? [value.section, ...sectionsForGrade]
      : sectionsForGrade;

  const updateField = <K extends keyof LearnerFormInput>(key: K, val: LearnerFormInput[K]) => {
    onChange({ ...value, [key]: val });
  };

  const updateParent = (
    which: 'primary_parent' | 'secondary_parent',
    key: keyof ParentInput,
    val: string
  ) => {
    onChange({
      ...value,
      [which]: {
        ...value[which],
        [key]: val,
      },
    });
  };

  return (
    <div className="form-grid">
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_learner_name`}>Learner&apos;s Full Name</label>
        <input
          type="text"
          id={`${prefix}_learner_name`}
          className="form-control"
          value={value.full_name}
          onChange={(e) => updateField('full_name', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_lrn`}>Learner Reference Number (LRN)</label>
        <input
          type="text"
          id={`${prefix}_lrn`}
          className="form-control"
          value={value.lrn}
          onChange={(e) => updateField('lrn', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_dob`}>Date of Birth</label>
        <input
          type="date"
          id={`${prefix}_dob`}
          className="form-control"
          value={value.date_of_birth}
          onChange={(e) => updateField('date_of_birth', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_grade_level`}>Grade Level</label>
        <select
          id={`${prefix}_grade_level`}
          className="form-control"
          value={value.grade_level}
          onChange={(e) => {
            onChange({
              ...value,
              grade_level: e.target.value,
              section: '',
            });
          }}
        >
          <option value="" disabled>
            Select Grade
          </option>
          {ALLOWED_GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_section`}>Section</label>
        <select
          id={`${prefix}_section`}
          className="form-control"
          value={value.section}
          onChange={(e) => updateField('section', e.target.value)}
        >
          <option value="" disabled>
            Select Section
          </option>
          {availableSections.map((sec) => (
            <option key={sec} value={sec}>
              {sec}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_school_year`}>School Year</label>
        <select
          id={`${prefix}_school_year`}
          className="form-control"
          value={value.school_year}
          onChange={(e) => updateField('school_year', e.target.value)}
        >
          {!value.school_year && (
            <option value="">-- Select School Year --</option>
          )}
          {schoolYears.map((sy) => (
            <option key={sy} value={sy}>
              {sy}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_blood_type`}>Blood Type (if known)</label>
        <input
          type="text"
          id={`${prefix}_blood_type`}
          className="form-control"
          value={value.blood_type}
          onChange={(e) => updateField('blood_type', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor={`${prefix}_status`}>Status</label>
        <select
          id={`${prefix}_status`}
          className="form-control"
          value={value.status}
          onChange={(e) => updateField('status', e.target.value)}
        >
          {STUDENT_STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group full-width">
        <label htmlFor={`${prefix}_home_address`}>Home Address</label>
        <textarea
          id={`${prefix}_home_address`}
          className="form-control"
          value={value.home_address}
          onChange={(e) => updateField('home_address', e.target.value)}
        />
      </div>

      <div className="form-group full-width">
        <label htmlFor={`${prefix}_allergies`}>Allergies / Medical Conditions</label>
        <textarea
          id={`${prefix}_allergies`}
          className="form-control"
          value={value.allergies}
          onChange={(e) => updateField('allergies', e.target.value)}
        />
      </div>

      <div className="form-group full-width">
        <label htmlFor={`${prefix}_medications`}>Maintenance Medications</label>
        <textarea
          id={`${prefix}_medications`}
          className="form-control"
          value={value.medications}
          onChange={(e) => updateField('medications', e.target.value)}
        />
      </div>

      {/* Primary Parent */}
      <h3
        style={{
          margin: '1.5rem 0 0.5rem',
          color: 'var(--text-dark)',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.5rem',
          gridColumn: '1 / -1',
        }}
      >
        Primary Parent Details
      </h3>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p1_name`}>Full Name</label>
        <input
          type="text"
          id={`${prefix}_p1_name`}
          className="form-control"
          value={value.primary_parent.full_name}
          onChange={(e) => updateParent('primary_parent', 'full_name', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${prefix}_p1_rel`}>Relationship</label>
        <input
          type="text"
          id={`${prefix}_p1_rel`}
          className="form-control"
          placeholder="e.g. Mother, Father"
          value={value.primary_parent.relationship}
          onChange={(e) => updateParent('primary_parent', 'relationship', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${prefix}_p1_mobile`}>Mobile Number</label>
        <input
          type="text"
          id={`${prefix}_p1_mobile`}
          className="form-control"
          value={value.primary_parent.mobile_number}
          onChange={(e) => updateParent('primary_parent', 'mobile_number', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${prefix}_p1_telephone`}>Telephone Number</label>
        <input
          type="text"
          id={`${prefix}_p1_telephone`}
          className="form-control"
          value={value.primary_parent.telephone_number}
          onChange={(e) => updateParent('primary_parent', 'telephone_number', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p1_email`}>Email Address</label>
        <input
          type="email"
          id={`${prefix}_p1_email`}
          className="form-control"
          value={value.primary_parent.email_address}
          onChange={(e) => updateParent('primary_parent', 'email_address', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p1_address`}>Home Address</label>
        <textarea
          id={`${prefix}_p1_address`}
          className="form-control"
          value={value.primary_parent.home_address}
          onChange={(e) => updateParent('primary_parent', 'home_address', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p1_workplace`}>Workplace</label>
        <input
          type="text"
          id={`${prefix}_p1_workplace`}
          className="form-control"
          value={value.primary_parent.workplace}
          onChange={(e) => updateParent('primary_parent', 'workplace', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p1_workplace_address`}>Workplace Address</label>
        <textarea
          id={`${prefix}_p1_workplace_address`}
          className="form-control"
          value={value.primary_parent.workplace_address}
          onChange={(e) => updateParent('primary_parent', 'workplace_address', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p1_emergency`}>Emergency Contact Number</label>
        <input
          type="text"
          id={`${prefix}_p1_emergency`}
          className="form-control"
          value={value.primary_parent.emergency_contact_number}
          onChange={(e) =>
            updateParent('primary_parent', 'emergency_contact_number', e.target.value)
          }
        />
      </div>

      {/* Secondary Parent */}
      <h3
        style={{
          margin: '1.5rem 0 0.5rem',
          color: 'var(--text-dark)',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.5rem',
          gridColumn: '1 / -1',
        }}
      >
        Secondary Parent Details
      </h3>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p2_name`}>Full Name</label>
        <input
          type="text"
          id={`${prefix}_p2_name`}
          className="form-control"
          value={value.secondary_parent.full_name}
          onChange={(e) => updateParent('secondary_parent', 'full_name', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${prefix}_p2_rel`}>Relationship</label>
        <input
          type="text"
          id={`${prefix}_p2_rel`}
          className="form-control"
          value={value.secondary_parent.relationship}
          onChange={(e) => updateParent('secondary_parent', 'relationship', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${prefix}_p2_mobile`}>Mobile Number</label>
        <input
          type="text"
          id={`${prefix}_p2_mobile`}
          className="form-control"
          value={value.secondary_parent.mobile_number}
          onChange={(e) => updateParent('secondary_parent', 'mobile_number', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${prefix}_p2_telephone`}>Telephone Number</label>
        <input
          type="text"
          id={`${prefix}_p2_telephone`}
          className="form-control"
          value={value.secondary_parent.telephone_number}
          onChange={(e) => updateParent('secondary_parent', 'telephone_number', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p2_email`}>Email Address</label>
        <input
          type="email"
          id={`${prefix}_p2_email`}
          className="form-control"
          value={value.secondary_parent.email_address}
          onChange={(e) => updateParent('secondary_parent', 'email_address', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p2_address`}>Home Address</label>
        <textarea
          id={`${prefix}_p2_address`}
          className="form-control"
          value={value.secondary_parent.home_address}
          onChange={(e) => updateParent('secondary_parent', 'home_address', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p2_workplace`}>Workplace</label>
        <input
          type="text"
          id={`${prefix}_p2_workplace`}
          className="form-control"
          value={value.secondary_parent.workplace}
          onChange={(e) => updateParent('secondary_parent', 'workplace', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p2_workplace_address`}>Workplace Address</label>
        <textarea
          id={`${prefix}_p2_workplace_address`}
          className="form-control"
          value={value.secondary_parent.workplace_address}
          onChange={(e) => updateParent('secondary_parent', 'workplace_address', e.target.value)}
        />
      </div>
      <div className="form-group full-width">
        <label htmlFor={`${prefix}_p2_emergency`}>Emergency Contact Number</label>
        <input
          type="text"
          id={`${prefix}_p2_emergency`}
          className="form-control"
          value={value.secondary_parent.emergency_contact_number}
          onChange={(e) =>
            updateParent('secondary_parent', 'emergency_contact_number', e.target.value)
          }
        />
      </div>

      {/* Authorized Persons of Contact (Reunification) */}
      <div style={{ gridColumn: '1 / -1', margin: '1.5rem 0 0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-dark)', fontSize: '1.1rem' }}>
            Authorized Person of Contact (Reunification)
          </h3>
          {(value.reunification_contacts?.length ?? 0) < 3 && (
            <button
              type="button"
              className="control-btn"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={() => {
                const current = value.reunification_contacts ?? [];
                if (current.length < 3) {
                  onChange({
                    ...value,
                    reunification_contacts: [...current, { name: '', relationship: '' }],
                  });
                }
              }}
            >
              + Add Person ({(value.reunification_contacts?.length ?? 0)}/3)
            </button>
          )}
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Authorized persons for student reunification. Maximum 3 individuals (Name and Relationship to student only).
        </p>
      </div>

      {(value.reunification_contacts ?? []).map((contact, idx) => (
        <div
          key={idx}
          style={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: '1rem',
            alignItems: 'flex-end',
            padding: '0.75rem 1rem',
            background: '#fafafa',
            borderRadius: '8px',
            border: '1px solid var(--border-light)',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor={`${prefix}_auth_name_${idx}`} style={{ fontSize: '0.75rem' }}>
              Person {idx + 1} Name
            </label>
            <input
              type="text"
              id={`${prefix}_auth_name_${idx}`}
              className="form-control"
              placeholder="Full Name"
              value={contact.name}
              onChange={(e) => {
                const next = [...(value.reunification_contacts ?? [])];
                next[idx] = { ...next[idx], name: e.target.value };
                onChange({ ...value, reunification_contacts: next });
              }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor={`${prefix}_auth_rel_${idx}`} style={{ fontSize: '0.75rem' }}>
              Relationship
            </label>
            <input
              type="text"
              id={`${prefix}_auth_rel_${idx}`}
              className="form-control"
              placeholder="e.g. Aunt, Grandparent, Relative"
              value={contact.relationship}
              onChange={(e) => {
                const next = [...(value.reunification_contacts ?? [])];
                next[idx] = { ...next[idx], relationship: e.target.value };
                onChange({ ...value, reunification_contacts: next });
              }}
            />
          </div>
          <button
            type="button"
            className="control-btn"
            style={{ height: '38px', color: '#dc2626', borderColor: '#fca5a5' }}
            title="Remove person"
            onClick={() => {
              const next = (value.reunification_contacts ?? []).filter((_, i) => i !== idx);
              onChange({ ...value, reunification_contacts: next });
            }}
          >
            Remove
          </button>
        </div>
      ))}
      {(value.reunification_contacts?.length ?? 0) === 0 && (
        <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
          No authorized contacts added yet. Click &quot;+ Add Person&quot; to specify reunification contacts (up to 3).
        </div>
      )}
    </div>
  );
}

