import { Container, Spinner } from "@chakra-ui/react";

export default function Loading() {
  return (
    <Container maxW="container.xl" h="100dvh" display="flex" alignItems="center" justifyContent="center">
      <Spinner />
    </Container>
  );
}

