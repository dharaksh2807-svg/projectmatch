import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Tailwind,
} from "@react-email/components";


interface ApplicationStatusEmailProps {
  applicantName: string;
  projectTitle: string;
  roleTitle: string;
  status: "ACCEPTED" | "REJECTED";
  projectOwnerName: string;
  projectUrl: string;
}

export const ApplicationStatusEmail = ({
  applicantName,
  projectTitle,
  roleTitle,
  status,
  projectOwnerName,
  projectUrl,
}: ApplicationStatusEmailProps) => {
  const isAccepted = status === "ACCEPTED";
  const previewText = isAccepted
    ? `You have been accepted to join ${projectTitle}!`
    : `Update on your application for ${projectTitle}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 my-auto mx-auto font-sans">
          <Container className="border border-solid border-gray-200 rounded my-[40px] mx-auto p-[20px] w-[465px] bg-white">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Project Match Application Update
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              Hi {applicantName},
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              {projectOwnerName} has reviewed your application for the{" "}
              <strong>{roleTitle}</strong> role on <strong>{projectTitle}</strong>.
            </Text>

            {isAccepted ? (
              <Section className="bg-green-50 p-4 rounded-md my-4">
                <Text className="text-green-800 text-[16px] font-semibold text-center m-0">
                  🎉 Congratulations! You have been accepted to join the team.
                </Text>
              </Section>
            ) : (
              <Section className="bg-gray-100 p-4 rounded-md my-4">
                <Text className="text-gray-600 text-[14px] text-center m-0">
                  Unfortunately, your application was not accepted at this time.
                </Text>
              </Section>
            )}

            {isAccepted && (
              <Section className="text-center mt-[32px] mb-[32px]">
                <Button
                  className="bg-black rounded text-white text-[12px] font-semibold no-underline text-center px-4 py-3"
                  href={projectUrl}
                >
                  View Project & Message Team
                </Button>
              </Section>
            )}

            <Text className="text-gray-500 text-[12px] leading-[24px] mt-4">
              Keep applying to projects and building your portfolio!
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ApplicationStatusEmail;
