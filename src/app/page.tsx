// pages/index.js (or app/page.js if using the app router)
import Link from 'next/link';
import Image from 'next/image'; // Import Image

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Infinity Kingdom Index</h1>
      <p className="mb-4">
        Infinity Kingdom Viewer
      </p>
       <Image
          src="/infinity.jpg"  //put your logo here.
          alt="Infinity logo"
          width={680}
          height={108}
          priority
        />
        <br></br>
      <Link href="/kingdoms" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          View Kingdoms
      </Link>
      <br></br><br></br>
      <Link href="/provinces" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          View Provinces Activity
      </Link>

    </div>
  );
}