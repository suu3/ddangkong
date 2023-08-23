'use client';

import Loading from '@/domains/coffee/Loading';
import Order from '@/domains/coffee/Order';
import Shuffle from '@/domains/coffee/Shuffle';
import Start from '@/domains/coffee/Start';
import { useState } from 'react';

export default function Coffee() {
  const [step, setStep] = useState(0);
  return (
    <div>
      {/* <Start /> */}
      {/* <Order /> */}
      {/* <Shuffle /> */}
      <Loading />
    </div>
  );
}
