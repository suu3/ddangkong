export default function CoffeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col justify-between items-center">
      {children}
    </section>
  );
}
