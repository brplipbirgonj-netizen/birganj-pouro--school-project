'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DISTRICTS, getUpazilas, getUnions, getPostOffices } from '@/data/bd-geodata';

const WARDS = [
  '১নং ওয়ার্ড',
  '২নং ওয়ার্ড',
  '৩নং ওয়ার্ড',
  '৪নং ওয়ার্ড',
  '৫নং ওয়ার্ড',
  '৬নং ওয়ার্ড',
  '৭নং ওয়ার্ড',
  '৮নং ওয়ার্ড',
  '৯নং ওয়ার্ড',
];

type LocationValue = {
  district: string;
  upazila: string;
  union: string;
  postOffice: string;
  village: string;
};

type Props = {
  prefix: 'present' | 'permanent';
  values: LocationValue;
  onChange: (field: any, value: string) => void;
  required?: boolean;
  inputFocusClasses?: string;
};

export function LocationSelector({ prefix, values, onChange, required, inputFocusClasses }: Props) {
  const upazilas = getUpazilas(values.district);
  const unions = getUnions(values.district, values.upazila);
  const postOffices = getPostOffices(values.district, values.upazila);

  // Allow custom union / post office if user chooses custom
  const [isCustomUnion, setIsCustomUnion] = useState(false);
  const [isCustomPO, setIsCustomPO] = useState(false);
  const [selectedWard, setSelectedWard] = useState<string>('');

  // If the passed union/PO isn't in standard list (e.g., loaded from previous data), enable custom mode
  useEffect(() => {
    if (values.union && unions.length > 0 && !unions.includes(values.union)) {
      setIsCustomUnion(true);
    }
    if (values.postOffice && postOffices.length > 0 && !postOffices.includes(values.postOffice)) {
      setIsCustomPO(true);
    }
  }, [values.district, values.upazila, values.union, values.postOffice, unions, postOffices]);

  const handleDistrict = (val: string) => {
    onChange(`${prefix}District`, val);
    onChange(`${prefix}Upazila`, '');
    onChange(`${prefix}Union`, '');
    onChange(`${prefix}PostOffice`, '');
    onChange(`${prefix}Village`, '');
    setIsCustomUnion(false);
    setIsCustomPO(false);
    setSelectedWard('');
  };

  const handleUpazila = (val: string) => {
    onChange(`${prefix}Upazila`, val);
    onChange(`${prefix}Union`, '');
    onChange(`${prefix}PostOffice`, '');
    onChange(`${prefix}Village`, '');
    setIsCustomUnion(false);
    setIsCustomPO(false);
    setSelectedWard('');
  };

  const handleUnionSelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomUnion(true);
      onChange(`${prefix}Union`, '');
    } else {
      setIsCustomUnion(false);
      onChange(`${prefix}Union`, val);
    }
  };

  const handlePostOfficeSelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomPO(true);
      onChange(`${prefix}PostOffice`, '');
    } else {
      setIsCustomPO(false);
      onChange(`${prefix}PostOffice`, val);
    }
  };

  const handleWardSelect = (ward: string) => {
    setSelectedWard(ward);
    // If village doesn't contain ward, append or prefix it cleanly
    const currentVillage = values.village || '';
    // Strip old ward if present
    const cleanVillage = currentVillage.replace(/\s*\(?\d+নং\s*ওয়ার্ড\)?/g, '').replace(/,\s*$/, '').trim();
    if (ward && ward !== 'none') {
      const updated = cleanVillage ? `${cleanVillage}, ${ward}` : ward;
      onChange(`${prefix}Village`, updated);
    } else if (ward === 'none') {
      onChange(`${prefix}Village`, cleanVillage);
    }
  };

  const isRequired = required ?? (prefix === 'present');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* জেলা নির্বাচন */}
      <div className="space-y-2">
        <Label className="font-bold flex items-center justify-between">
          <span>জেলা {isRequired && <span className="text-red-500">*</span>}</span>
          <span className="text-xs text-muted-foreground font-normal">৬৪ জেলা</span>
        </Label>
        <Select value={values.district || ''} onValueChange={handleDistrict}>
          <SelectTrigger className={`${inputFocusClasses ?? ''} ${!values.district && isRequired ? 'border-red-300 bg-red-50/30' : ''}`}>
            <SelectValue placeholder="— জেলা বেছে নিন —" />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            {DISTRICTS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* উপজেলা নির্বাচন */}
      <div className="space-y-2">
        <Label className="font-bold flex items-center justify-between">
          <span>উপজেলা {isRequired && <span className="text-red-500">*</span>}</span>
          {values.district && (
            <span className="text-xs text-emerald-600 font-semibold">{upazilas.length}টি উপজেলা</span>
          )}
        </Label>
        <Select
          value={values.upazila || ''}
          onValueChange={handleUpazila}
          disabled={!values.district}
        >
          <SelectTrigger className={`${inputFocusClasses ?? ''} ${!values.upazila && isRequired ? 'border-red-300 bg-red-50/30' : ''}`}>
            <SelectValue placeholder={values.district ? '— উপজেলা বেছে নিন —' : '— আগে জেলা নির্বাচন করুন —'} />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            {upazilas.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ইউনিয়ন / পৌরসভা নির্বাচন */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="font-bold">ইউনিয়ন / পৌরসভা</Label>
          {isCustomUnion ? (
            <button
              type="button"
              onClick={() => setIsCustomUnion(false)}
              className="text-xs text-primary underline font-medium"
            >
              তালিকায় ফিরুন
            </button>
          ) : (
            values.upazila && (
              <button
                type="button"
                onClick={() => setIsCustomUnion(true)}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                অন্যান্য/লিখুন
              </button>
            )
          )}
        </div>
        {isCustomUnion ? (
          <Input
            value={values.union || ''}
            onChange={(e) => onChange(`${prefix}Union`, e.target.value)}
            placeholder="ইউনিয়ন বা পৌরসভার নাম লিখুন"
            className={inputFocusClasses}
          />
        ) : (
          <Select
            value={values.union || ''}
            onValueChange={handleUnionSelect}
            disabled={!values.upazila}
          >
            <SelectTrigger className={inputFocusClasses ?? ''}>
              <SelectValue placeholder={values.upazila ? '— ইউনিয়ন বেছে নিন —' : '— আগে উপজেলা নির্বাচন করুন —'} />
            </SelectTrigger>
            <SelectContent className="max-h-72 overflow-y-auto">
              {unions.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
              <SelectItem value="__custom__" className="text-primary font-bold">
                ✏️ অন্যান্য (নিজে লিখুন)
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ডাকঘর নির্বাচন */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="font-bold">ডাকঘর</Label>
          {isCustomPO ? (
            <button
              type="button"
              onClick={() => setIsCustomPO(false)}
              className="text-xs text-primary underline font-medium"
            >
              তালিকায় ফিরুন
            </button>
          ) : (
            values.upazila && (
              <button
                type="button"
                onClick={() => setIsCustomPO(true)}
                className="text-xs text-muted-foreground hover:text-primary underline"
              >
                অন্যান্য/লিখুন
              </button>
            )
          )}
        </div>
        {isCustomPO ? (
          <Input
            value={values.postOffice || ''}
            onChange={(e) => onChange(`${prefix}PostOffice`, e.target.value)}
            placeholder="ডাকঘরের নাম লিখুন"
            className={inputFocusClasses}
          />
        ) : (
          <Select
            value={values.postOffice || ''}
            onValueChange={handlePostOfficeSelect}
            disabled={!values.upazila}
          >
            <SelectTrigger className={inputFocusClasses ?? ''}>
              <SelectValue placeholder={values.upazila ? '— ডাকঘর বেছে নিন —' : '— আগে উপজেলা নির্বাচন করুন —'} />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto">
              {postOffices.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
              <SelectItem value="__custom__" className="text-primary font-bold">
                ✏️ অন্যান্য (নিজে লিখুন)
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ওয়ার্ড ও গ্রাম/মহল্লা সেকশন */}
      <div className="space-y-2 sm:col-span-2 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="font-bold text-xs text-slate-700">ওয়ার্ড নং (ঐচ্ছিক)</Label>
            <Select
              value={selectedWard}
              onValueChange={handleWardSelect}
              disabled={!values.union}
            >
              <SelectTrigger className="h-10 text-xs bg-white">
                <SelectValue placeholder={values.union ? '— ওয়ার্ড বাছুন —' : '— আগে ইউনিয়ন বাছুন —'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ওয়ার্ড ছাড়া</SelectItem>
                {WARDS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="font-bold text-xs text-slate-700">
              গ্রাম / মহল্লা / রাস্তা {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Input
              required={isRequired}
              value={values.village || ''}
              onChange={(e) => onChange(`${prefix}Village`, e.target.value)}
              placeholder="গ্রাম বা মহল্লার নাম লিখুন (যেমন: ভাবকী, পূর্ব সুজালপুর)"
              className={`${inputFocusClasses ?? ''} h-10 bg-white ${
                !values.village && isRequired ? 'border-red-300 bg-red-50/30' : ''
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
