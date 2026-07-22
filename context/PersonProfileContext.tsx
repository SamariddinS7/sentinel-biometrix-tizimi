/**
 * PersonProfileContext — Global shaxs profili konteksti
 *
 * Ilovaning istalgan joyidan openProfile(personId) chaqirib, shaxs profilini ochish mumkin.
 * PersonNameLink komponenti orqali ismni bosish = profil ochish.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { PersonAttributeProfile } from '../components/PersonAttributeProfile';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface PersonProfileContextValue {
  /** Shaxs profilini global panelda ochadi */
  openProfile: (personId: string) => void;
}

const PersonProfileContext = createContext<PersonProfileContextValue>({
  openProfile: () => {},
});

export const usePersonProfile = () => useContext(PersonProfileContext);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const PersonProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const openProfile = useCallback((personId: string) => {
    if (personId) setOpenId(personId);
  }, []);

  return (
    <PersonProfileContext.Provider value={{ openProfile }}>
      {children}
      {openId && (
        <PersonAttributeProfile
          personId={openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </PersonProfileContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PersonNameLink — Bosilsa profil ochiladigan ism komponenti
// ─────────────────────────────────────────────────────────────────────────────

interface PersonNameLinkProps {
  /** Bazadagi shaxs IDsi (user.id, personId, userId...) */
  personId: string;
  /** Ko'rsatiladigan ism matni */
  name: string;
  /** Qo'shimcha Tailwind klasslari */
  className?: string;
}

/**
 * Istalgan komponentda foydalaning:
 *   <PersonNameLink personId={user.id} name={user.fullName} />
 *
 * Bosganingizda global PersonAttributeProfile paneli ochiladi.
 * Ota-komponentning onClick bilan to'qnashuv bo'lmasin deb stopPropagation ishlatilgan.
 */
export const PersonNameLink: React.FC<PersonNameLinkProps> = ({ personId, name, className }) => {
  const { openProfile } = usePersonProfile();

  if (!personId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openProfile(personId);
      }}
      title={`${name} profilini ko'rish`}
      className={[
        'text-left cursor-pointer transition-colors duration-150',
        'hover:text-cyan-400 hover:underline underline-offset-2',
        className ?? '',
      ].join(' ')}
    >
      {name}
    </button>
  );
};
